import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service.js';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { RaceRow, UmamusumeRow, PatternData } from '../race.types.js';
import {
  LARC_SPECIFIC_NAMES,
  BC_MANDATORY,
} from './pattern.constants.js';
import type { FetchedRaceData } from './pattern.types.js';
import {
  buildPatternFromGrid,
  getAllRacesInPattern,
  calculateAndSetMainConditions,
  calculateFactorComposition,
} from './pattern.helpers.js';
import { BCPatternBuilderService } from './bc-pattern-builder.service.js';
import { LarcPatternBuilderService } from './larc-pattern-builder.service.js';

/**
 * 育成ローテーションパターン生成サービス（オーケストレーター）
 *
 * DB からデータを取得し、BCPatternBuilderService / LarcPatternBuilderService に
 * アルゴリズムを委譲してパターンを生成する。
 *
 * ウマ娘の残レースをグリッドベース一括割り当てアルゴリズムで複数の育成パターンに分配し、
 * 適性・シナリオ制約・連続出走制限を考慮した最適なローテーションを生成する。
 */
@Injectable()
export class RacePatternService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(RacePatternService.name) private readonly logger: PinoLogger,
    private readonly bcBuilder: BCPatternBuilderService,
    private readonly larcBuilder: LarcPatternBuilderService,
  ) {}

  /**
   * 指定ウマ娘の残レースから育成ローテーションパターン一覧を生成する
   *
   * Phase 1: 対象ウマ娘データ・出走済みレースデータ・残レースデータを取得
   * Phase 2: BCシナリオの残レース数を取得
   * Phase 3: BC数分のパターンを生成
   * Phase 4: BCシナリオの中間レースを設定し、出走済みに追加・残レースから除外
   * Phase 5: BC最終レースの適性を判断し、適性オブジェクトをパターンに設定
   * Phase 6: ジュニア7月頭から時系列で残レースを各パターンへ割り当て
   * Phase 7: BC を優先するため Phase 6 後の残レースでオーバーフロー BC パターンを追加
   * Phase 8: ラークのレースが残レースに存在すれば BC 割り当て後の残レースのみでラークパターンを追加
   * Phase 9: 各パターン後処理（因子計算・主馬場距離集計）
   *
   * @param userId - 対象ユーザーの UUID
   * @param umamusumeId - 対象ウマ娘 ID
   * @returns 育成パターン配列と対象ウマ娘名
   * @throws {InternalServerErrorException} 登録ウマ娘が見つからない場合
   */
  async getRacePattern(userId: string, umamusumeId: number) {
    this.logger.info({ userId, umamusumeId }, 'パターン生成開始');

    // Phase 1
    const fetched = await this.fetchRaceData(userId, umamusumeId);
    const { umaData, allGRaces, allBCMandatoryRaces, remainingRacesAll, hasRemainingLarc, registRaceIds } = fetched;

    if (remainingRacesAll.length === 0) {
      return { patterns: [] as PatternData[], umamusumeName: umaData.umamusume_name };
    }

    // Phase 2: BCシナリオの残レース数を取得
    const remainingBCRaces = remainingRacesAll.filter((r) => r.bc_flag);
    const nBC = remainingBCRaces.length;

    this.logger.debug({ nBC, hasRemainingLarc }, 'Phase 2 完了: BC残レース数取得');

    // Phase 3-5
    const bcInit = this.bcBuilder.initializeBCPatterns(
      umaData, remainingBCRaces, remainingRacesAll, allBCMandatoryRaces, hasRemainingLarc,
    );
    const { sortedBCRaces, grid, patternStrategies, aptitudeStates, racesToAssign } = bcInit;
    const scenarioTypes: ('bc' | 'larc')[] = Array.from({ length: nBC }, () => 'bc');

    // Phase 6
    const assignedRaceIds = this.bcBuilder.assignRacesToBCGrids(
      nBC, sortedBCRaces, grid, patternStrategies, aptitudeStates, racesToAssign, umaData,
    );

    // Phase 7: BC を優先するため先にオーバーフロー BC を追加
    const remainingAfterPhase6 = racesToAssign.filter((r) => !assignedRaceIds.has(r.race_id));
    const overflowAssignedIds = new Set<number>();
    if (remainingAfterPhase6.length > 0) {
      const overflowResults = this.bcBuilder.buildOverflowPatterns(
        remainingAfterPhase6, allGRaces, allBCMandatoryRaces, umaData,
      );
      for (const { grid: og, strategy: os, aptState: oa } of overflowResults) {
        for (const race of og.values()) overflowAssignedIds.add(race.race_id);
        grid.push(og);
        patternStrategies.push(os);
        aptitudeStates.push(oa);
        scenarioTypes.push('bc');
      }
      this.logger.info({ overflowCount: overflowResults.length }, 'Phase 7 完了: オーバーフロー BC パターン追加');
    }

    // Phase 8: ラークパターンを BC 割り当て後の残レースのみで構築
    const larcAptState = this.larcBuilder.buildLarcAptitudeState(umaData);
    if (hasRemainingLarc) {
      const allAssignedBeforeLarc = new Set([...assignedRaceIds, ...overflowAssignedIds]);
      const larcGrid = this.larcBuilder.buildLarcGrid(
        racesToAssign, allAssignedBeforeLarc, allGRaces, larcAptState,
      );
      grid.push(larcGrid);
      patternStrategies.push(null);
      aptitudeStates.push(larcAptState);
      scenarioTypes.push('larc');
      this.logger.info({ umamusumeId }, 'Phase 8 完了: ラークパターン追加');
    }

    // Phase 9
    const result = this.buildAndFinalizePatterns(
      grid, scenarioTypes, patternStrategies, aptitudeStates, umaData, allGRaces,
    );
    return { ...result, registeredRaceIds: Array.from(registRaceIds) };
  }

  /**
   * Phase 1: DB からウマ娘・レースデータを取得し、中間データを返す
   * @param userId - 対象ユーザーの UUID
   * @param umamusumeId - 対象ウマ娘 ID
   * @returns DB 取得データをまとめた FetchedRaceData
   * @throws {InternalServerErrorException} 登録ウマ娘が見つからない場合
   */
  private async fetchRaceData(userId: string, umamusumeId: number): Promise<FetchedRaceData> {
    const registData = await this.prisma.registUmamusumeTable.findUnique({
      where: { user_id_umamusume_id: { user_id: userId, umamusume_id: umamusumeId } },
      include: { umamusume: true },
    });
    if (!registData) {
      this.logger.error({ userId, umamusumeId }, '登録ウマ娘が見つかりません');
      throw new InternalServerErrorException('登録ウマ娘が見つかりません');
    }
    const umaData: UmamusumeRow = registData.umamusume;

    const registRaceRows = await this.prisma.registUmamusumeRaceTable.findMany({
      where: { user_id: userId, umamusume_id: umamusumeId },
      select: { race_id: true },
    });
    const registRaceIds = new Set<number>(registRaceRows.map((r) => r.race_id));

    const allGRaces: RaceRow[] = await this.prisma.raceTable.findMany({
      where: { race_rank: { in: [1, 2, 3] } },
    });

    // BC 必須中間レースは出走済みでも配置するため、registRaceIds でフィルタせず全件取得する
    const bcMandatoryAllNames = Array.from(
      new Set(Object.values(BC_MANDATORY).flat().map(([, name]) => name)),
    );
    const allBCMandatoryRaces: RaceRow[] = await this.prisma.raceTable.findMany({
      where: { race_name: { in: bcMandatoryAllNames } },
    });

    const remainingRacesAll = allGRaces.filter((r) => !registRaceIds.has(r.race_id));

    this.logger.debug(
      { umamusumeName: umaData.umamusume_name, remainingCount: remainingRacesAll.length },
      'Phase 1 完了: データ取得',
    );

    const hasRemainingLarc = remainingRacesAll.some(
      (r) => r.larc_flag || LARC_SPECIFIC_NAMES.has(r.race_name),
    );

    return { umaData, allGRaces, allBCMandatoryRaces, remainingRacesAll, hasRemainingLarc, registRaceIds };
  }

  /**
   * Phase 9: グリッドから PatternData を構築し後処理（因子計算・主馬場距離集計）を実行する
   * @param grid - 全パターンのグリッド配列
   * @param scenarioTypes - 各パターンのシナリオ種別（'bc' | 'larc'）
   * @param patternStrategies - 各パターンの因子戦略
   * @param aptitudeStates - 各パターンの適性状態
   * @param umaData - 対象ウマ娘の行データ
   * @param allGRaces - 全 G1/G2/G3 レースの RaceRow 配列
   * @returns 後処理済みのパターン配列とウマ娘名
   */
  private buildAndFinalizePatterns(
    grid: Map<string, RaceRow>[],
    scenarioTypes: ('bc' | 'larc')[],
    patternStrategies: (Record<string, number> | null)[],
    aptitudeStates: ReturnType<LarcPatternBuilderService['buildLarcAptitudeState']>[],
    umaData: UmamusumeRow,
    allGRaces: RaceRow[],
  ): { patterns: PatternData[]; umamusumeName: string } {
    const patterns: PatternData[] = grid.map((patternGrid, pi) => {
      const pattern = buildPatternFromGrid(patternGrid);
      if (scenarioTypes[pi] === 'larc') {
        pattern.scenario = 'larc';
        pattern.strategy = null;
        pattern.aptitudeState = aptitudeStates[pi];
      } else {
        pattern.scenario = 'bc';
        pattern.strategy = patternStrategies[pi] ?? null;
        pattern.aptitudeState = aptitudeStates[pi];
      }
      return pattern;
    });

    for (const pattern of patterns) {
      const isLarc = pattern.scenario === 'larc';
      const finalRaces = getAllRacesInPattern(pattern, allGRaces);
      calculateAndSetMainConditions(pattern, finalRaces);
      pattern.factors = calculateFactorComposition(
        umaData, finalRaces, pattern.strategy ?? null, isLarc,
      );
      pattern.totalRaces = finalRaces.length;
    }

    const finalPatterns = patterns.filter((p) => (p.totalRaces ?? 0) > 0);

    this.logger.info(
      { umamusumeName: umaData.umamusume_name, patternCount: finalPatterns.length },
      'パターン生成完了',
    );
    return { patterns: finalPatterns, umamusumeName: umaData.umamusume_name };
  }
}
