import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service.js';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { RaceRow, UmamusumeRow, PatternData, AptitudeState } from '../race.types.js';
import {
  LARC_EXCLUSIVE_NAMES,
  LARC_MANDATORY,
  LARC_SPECIFIC_NAMES,
  BC_FINAL_SLOT,
  BC_MANDATORY,
  ORDERED_SLOTS,
  RANK_ORDER,
} from './pattern.constants.js';
import type { FetchedRaceData, BCPatternsInit } from './pattern.types.js';
import {
  sk,
  getAvailableSlots,
  isLarcRestrictedSlot,
  isBCRestrictedSlot,
  getConsecutiveLength,
  isConsecutiveViolation,
  buildPatternFromGrid,
  getAllRacesInPattern,
  calculateAndSetMainConditions,
  calcBCStrategy,
  buildAptitudeState,
  applyStrategyToAptitude,
  raceMatchesAptitude,
  isRaceRunnable,
  calcRunnableEnhancement,
  calculateFactorComposition,
} from './pattern.helpers.js';

/**
 * 育成ローテーションパターン生成サービス
 *
 * ウマ娘の残レースをグリッドベース一括割り当てアルゴリズムで複数の育成パターンに分配し、
 * 適性・シナリオ制約・連続出走制限を考慮した最適なローテーションを生成する。
 */
@Injectable()
export class RacePatternService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(RacePatternService.name) private readonly logger: PinoLogger,
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
      return { patterns: [], umamusumeName: umaData.umamusume_name };
    }

    // Phase 2: BCシナリオの残レース数を取得
    const remainingBCRaces = remainingRacesAll.filter((r) => r.bc_flag);
    const nBC = remainingBCRaces.length;

    this.logger.debug({ nBC, hasRemainingLarc }, 'Phase 2 完了: BC残レース数取得');

    // Phase 3-5
    const bcInit = this.initializeBCPatterns(
      umaData, remainingBCRaces, remainingRacesAll, allBCMandatoryRaces, hasRemainingLarc,
    );
    const { sortedBCRaces, grid, patternStrategies, aptitudeStates, racesToAssign } = bcInit;
    const scenarioTypes: ('bc' | 'larc')[] = Array.from({ length: nBC }, () => 'bc');

    // Phase 6
    const assignedRaceIds = this.assignRacesToBCGrids(
      nBC, sortedBCRaces, grid, patternStrategies, aptitudeStates, racesToAssign, umaData,
    );

    // Phase 7: BC を優先するため先にオーバーフロー BC を追加
    const remainingAfterPhase6 = racesToAssign.filter((r) => !assignedRaceIds.has(r.race_id));
    const overflowAssignedIds = new Set<number>();
    if (remainingAfterPhase6.length > 0) {
      const overflowResults = this.buildOverflowPatterns(remainingAfterPhase6, allGRaces, allBCMandatoryRaces, umaData);
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
    const larcAptState = this.buildLarcAptitudeState(umaData);
    if (hasRemainingLarc) {
      const allAssignedBeforeLarc = new Set([...assignedRaceIds, ...overflowAssignedIds]);
      const larcGrid = this.buildLarcGrid(
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
   * Phase 3-5: BCパターンのグリッド・戦略・適性を初期化し、割り当て対象レースを絞り込む
   * - Phase 3: A/B パターンのソートとグリッド生成
   * - Phase 4: BC最終・中間レースの強制配置
   * - Phase 5: 因子戦略を適性状態に適用
   * @param umaData - 対象ウマ娘の行データ
   * @param remainingBCRaces - 未出走の BC 最終レース配列
   * @param remainingRacesAll - 全未出走レース配列
   * @param hasRemainingLarc - ラーク関連残レースが存在するか
   * @returns 初期化済み BCPatternsInit オブジェクト
   */
  private initializeBCPatterns(
    umaData: UmamusumeRow,
    remainingBCRaces: RaceRow[],
    remainingRacesAll: RaceRow[],
    allBCMandatoryRaces: RaceRow[],
    hasRemainingLarc: boolean,
  ): BCPatternsInit {
    const nBC = remainingBCRaces.length;

    // Phase 3: A パターン（補修あり）→ B パターン（補修なし）の順にソート
    const sortedBCRaces = nBC > 0
      ? [...remainingBCRaces].sort((a, b) => {
          const stratA = calcBCStrategy(a, umaData);
          const stratB = calcBCStrategy(b, umaData);
          if (stratA && !stratB) return -1;
          if (!stratA && stratB) return 1;
          return 0;
        })
      : [];

    const grid: Map<string, RaceRow>[] = Array.from({ length: nBC }, () => new Map());
    const patternStrategies: (Record<string, number> | null)[] = sortedBCRaces.map(
      (bc) => calcBCStrategy(bc, umaData),
    );
    const aptitudeStates: AptitudeState[] = sortedBCRaces.map(() => buildAptitudeState(umaData));

    this.logger.debug({ nBC }, 'Phase 3 完了: パターン生成');

    // Phase 4: BC最終レースをグリッドに配置し、中間レースを強制配置
    const bcMandatoryPrePlacedIds = new Set<number>();
    const bcFinalSlotKey = sk(BC_FINAL_SLOT.grade, BC_FINAL_SLOT.month, BC_FINAL_SLOT.half);

    for (let i = 0; i < nBC; i++) {
      grid[i].set(bcFinalSlotKey, sortedBCRaces[i]);
    }

    for (let i = 0; i < nBC; i++) {
      const bcFinalName = sortedBCRaces[i].race_name;
      const mandatory = BC_MANDATORY[bcFinalName] ?? [];
      for (const [grade, raceName, month, half] of mandatory) {
        const slotK = sk(grade, month, half);
        if (grid[i].has(slotK)) continue;
        const race = allBCMandatoryRaces.find((r) => r.race_name === raceName);
        if (!race) continue; // BC_MANDATORY に定義されているが DB に存在しない場合
        grid[i].set(slotK, race);
        bcMandatoryPrePlacedIds.add(race.race_id);
      }
    }

    this.logger.debug({ bcMandatoryCount: bcMandatoryPrePlacedIds.size }, 'Phase 4 完了: BC中間レース配置・除外');

    // Phase 5: 因子戦略を適性状態に適用
    for (let i = 0; i < nBC; i++) {
      const strategy = patternStrategies[i];
      if (strategy) {
        aptitudeStates[i] = applyStrategyToAptitude(aptitudeStates[i], strategy);
      }
    }

    this.logger.debug({}, 'Phase 5 完了: 適性オブジェクト設定');

    // 割り当て対象レースの絞り込み（ラーク専用・BC・BC中間を除外）
    const racesToAssign = remainingRacesAll.filter(
      (r) =>
        !(hasRemainingLarc && LARC_EXCLUSIVE_NAMES.has(r.race_name)) &&
        !r.bc_flag &&
        !bcMandatoryPrePlacedIds.has(r.race_id),
    );

    return { sortedBCRaces, grid, patternStrategies, aptitudeStates, bcMandatoryPrePlacedIds, racesToAssign };
  }

  /**
   * Phase 6: 時系列で残レースを各 BC パターンへ割り当てる
   * grid / patternStrategies / aptitudeStates を直接更新し、割り当て済みレース ID セットを返す
   * @param nBC - BC パターン数
   * @param sortedBCRaces - A パターン先頭でソート済みの BC 最終レース配列
   * @param grid - 各パターンのグリッド（直接更新される）
   * @param patternStrategies - 各パターンの因子戦略（直接更新される）
   * @param aptitudeStates - 各パターンの適性状態（直接更新される）
   * @param racesToAssign - 割り当て対象の残レース配列
   * @param umaData - 対象ウマ娘の行データ
   * @returns 割り当て済みレース ID のセット
   */
  private assignRacesToBCGrids(
    nBC: number,
    sortedBCRaces: (RaceRow | undefined)[],
    grid: Map<string, RaceRow>[],
    patternStrategies: (Record<string, number> | null)[],
    aptitudeStates: AptitudeState[],
    racesToAssign: RaceRow[],
    umaData: UmamusumeRow,
  ): Set<number> {
    const assignedRaceIds = new Set<number>();

    for (const slot of ORDERED_SLOTS) {
      if (isBCRestrictedSlot(slot.grade, slot.month, slot.half)) continue;

      const slotK = sk(slot.grade, slot.month, slot.half);

      const candidateRaces = racesToAssign.filter((race) => {
        if (assignedRaceIds.has(race.race_id)) return false;
        return getAvailableSlots(race).some(
          (s) => s.grade === slot.grade && s.month === slot.month && s.half === slot.half,
        );
      });

      if (candidateRaces.length === 0) continue;

      const candidates: {
        race: RaceRow;
        pi: number;
        score: number;
        needsStrategySet: boolean;
        enhancement: Record<string, number> | null;
      }[] = [];

      for (const race of candidateRaces) {
        for (let pi = 0; pi < nBC; pi++) {
          if (grid[pi].has(slotK)) continue;
          if (isConsecutiveViolation(grid[pi], slotK)) continue;

          let enhancement: Record<string, number> | null = null;
          if (!isRaceRunnable(race, aptitudeStates[pi])) {
            enhancement = calcRunnableEnhancement(race, aptitudeStates[pi], patternStrategies[pi]);
            if (!enhancement) continue;
          }

          const matchesApt = raceMatchesAptitude(race, aptitudeStates[pi], sortedBCRaces[pi]);
          const isNullStrategy = patternStrategies[pi] === null;
          let score = 0;
          let needsStrategySet = false;

          if (enhancement) {
            score += 1;
          } else if (matchesApt) {
            score += 10;
          } else if (isNullStrategy) {
            const raceStrategy = calcBCStrategy(race, umaData);
            if (raceStrategy === null) {
              score += 5;
            } else {
              score += 2;
              needsStrategySet = true;
            }
          }

          score -= getConsecutiveLength(grid[pi], slotK);
          score += (4 - race.race_rank);

          candidates.push({ race, pi, score, needsStrategySet, enhancement });
        }
      }

      if (candidates.length === 0) continue;

      candidates.sort((a, b) => b.score - a.score);

      const usedPatterns = new Set<number>();
      const usedRaces = new Set<number>();

      /** 因子補修戦略を既存 strategy にマージして適性状態を更新する */
      const applyEnhancement = (pi: number, enh: Record<string, number>) => {
        const merged: Record<string, number> = { ...(patternStrategies[pi] ?? {}) };
        for (const [key, val] of Object.entries(enh)) {
          merged[key] = (merged[key] ?? 0) + val;
        }
        patternStrategies[pi] = merged;
        aptitudeStates[pi] = applyStrategyToAptitude(buildAptitudeState(umaData), merged);
      };

      // まずスコア > 0 の候補で割り当て（適性マッチ・因子戦略未決定パターン優先）
      for (const { race, pi, score, needsStrategySet, enhancement } of candidates) {
        if (score <= 0) continue;
        if (usedPatterns.has(pi)) continue;
        if (usedRaces.has(race.race_id) || assignedRaceIds.has(race.race_id)) continue;

        if (needsStrategySet) {
          const newStrategy = calcBCStrategy(race, umaData);
          if (newStrategy) {
            patternStrategies[pi] = newStrategy;
            aptitudeStates[pi] = applyStrategyToAptitude(buildAptitudeState(umaData), newStrategy);
          }
        }
        if (enhancement) applyEnhancement(pi, enhancement);

        grid[pi].set(slotK, race);
        usedPatterns.add(pi);
        usedRaces.add(race.race_id);
        assignedRaceIds.add(race.race_id);
      }

      // スコア > 0 で割り当てられなかったレースをフォールバック割り当て（最後の手段）
      for (const { race, pi, enhancement } of candidates) {
        if (usedPatterns.has(pi)) continue;
        if (usedRaces.has(race.race_id) || assignedRaceIds.has(race.race_id)) continue;

        if (enhancement) applyEnhancement(pi, enhancement);

        grid[pi].set(slotK, race);
        usedPatterns.add(pi);
        usedRaces.add(race.race_id);
        assignedRaceIds.add(race.race_id);
      }
    }

    this.logger.debug({ assignedCount: assignedRaceIds.size }, 'Phase 6 完了: 時系列レース割り当て');
    return assignedRaceIds;
  }

  /**
   * ラークシナリオ補正後の適性状態を生成する
   * ラークシナリオでは芝・中距離適性がシナリオ補正により最低 A になる
   * @param umaData - 対象ウマ娘の行データ
   * @returns ラークシナリオ補正済みの適性状態オブジェクト
   */
  private buildLarcAptitudeState(umaData: UmamusumeRow): AptitudeState {
    const base = buildAptitudeState(umaData);
    const maxRank = (rank: string, min: string): string =>
      RANK_ORDER.indexOf(rank as (typeof RANK_ORDER)[number]) >=
      RANK_ORDER.indexOf(min as (typeof RANK_ORDER)[number])
        ? rank
        : min;
    return { ...base, turf: maxRank(base.turf, 'A'), classic: maxRank(base.classic, 'A') };
  }

  /**
   * Phase 8: ラークパターンのグリッドを構築する
   * LARC_MANDATORY を強制配置し、未割り当て残レースをラーク制限を考慮して配置する
   * @param racesToAssign - 割り当て対象の残レース配列
   * @param assignedRaceIds - Phase 6 までに割り当て済みのレース ID セット
   * @param allGRaces - 全 G1/G2/G3 レース配列（LARC_MANDATORY 検索に使用。出走済み含む）
   * @param larcAptState - ラークシナリオ補正済みの適性状態
   * @returns 構築済みのラークパターングリッド
   */
  private buildLarcGrid(
    racesToAssign: RaceRow[],
    assignedRaceIds: Set<number>,
    allGRaces: RaceRow[],
    larcAptState: AptitudeState,
  ): Map<string, RaceRow> {
    const larcGrid: Map<string, RaceRow> = new Map();

    for (const [grade, name, month, half] of LARC_MANDATORY) {
      const slotK = sk(grade, month, half);
      if (larcGrid.has(slotK)) continue;
      const larcRace = allGRaces.find((r) => r.race_name === name);
      if (larcRace) larcGrid.set(slotK, larcRace);
    }

    for (const race of racesToAssign) {
      if (assignedRaceIds.has(race.race_id)) continue;
      if (!isRaceRunnable(race, larcAptState)) continue;
      let placed = false;
      for (const slot of getAvailableSlots(race)) {
        if (placed) break;
        const slotK = sk(slot.grade, slot.month, slot.half);
        if (larcGrid.has(slotK)) continue;
        if (isLarcRestrictedSlot(slot.grade, slot.month, slot.half)) continue;
        if (isConsecutiveViolation(larcGrid, slotK)) continue;
        larcGrid.set(slotK, race);
        placed = true;
      }
    }

    return larcGrid;
  }

  /**
   * Phase 7: 未割り当て残レースをオーバーフロー BC パターンに割り当てる
   *
   * フェーズ1 残レースから BC 中間レースを抽出し、割り当て対象から除外する
   * フェーズ2 BC 中間レースが属する BC 最終レースの種類数 (nBCFromIntermediate) を求める
   * フェーズ3 残レース（BC 中間除外後）のスロット圧力からパターン数 (nFromWeight) を算出する（繰り下げ）
   *          N = max(nBCFromIntermediate, nFromWeight)
   * フェーズ4 N 個のパターンを初期化:
   *          - 先頭 nBCFromIntermediate 個: BC 最終・中間レース設定、因子戦略・適性を更新
   *          - 残りパターン: 因子戦略 null・初期適性状態
   * フェーズ5 assignRacesToBCGrids で全パターンへ残レースを一括割り当て
   *          （既にレースが設定されているスロットは自動スキップ）
   * フェーズ6 BC シナリオ未設定パターンに現在の適性状態で走れる BC シナリオを設定する
   *
   * @param remainingRaces - Phase 6 後の未割り当て残レース配列
   * @param allGRaces - 全 G1/G2/G3 レースの RaceRow 配列（BC テンプレート選択に使用）
   * @param allBCMandatoryRaces - BC 必須中間レースの全 RaceRow 配列（出走済み含む）
   * @param umaData - 対象ウマ娘の行データ
   * @returns オーバーフローパターンの grid / strategy / aptState の配列
   */
  private buildOverflowPatterns(
    remainingRaces: RaceRow[],
    allGRaces: RaceRow[],
    allBCMandatoryRaces: RaceRow[],
    umaData: UmamusumeRow,
  ): { grid: Map<string, RaceRow>; strategy: Record<string, number> | null; aptState: AptitudeState }[] {
    const bcFinalKey = sk(BC_FINAL_SLOT.grade, BC_FINAL_SLOT.month, BC_FINAL_SLOT.half);
    const allBCFinalRaces = allGRaces.filter((r) => r.bc_flag);

    // BC中間レース名 → BC最終レース名の逆引きマップ
    const intermediateNameToBCFinal = new Map<string, string>();
    for (const [bcFinalName, entries] of Object.entries(BC_MANDATORY)) {
      for (const [, raceName] of entries) {
        intermediateNameToBCFinal.set(raceName, bcFinalName);
      }
    }

    // フェーズ1: 残レースから BC 中間レースを抽出し、割り当て対象から除外する
    const bcIntermediateInRemaining = remainingRaces.filter(
      (r) => intermediateNameToBCFinal.has(r.race_name),
    );
    const bcIntermediateIds = new Set(bcIntermediateInRemaining.map((r) => r.race_id));
    const racesToAssign = remainingRaces.filter((r) => !bcIntermediateIds.has(r.race_id));

    // フェーズ2: BC 中間レースが属する BC 最終レースの種類数を求める
    const bcFinalNamesWithIntermediate = new Set<string>(
      bcIntermediateInRemaining.map((r) => intermediateNameToBCFinal.get(r.race_name)!),
    );
    const nBCFromIntermediate = bcFinalNamesWithIntermediate.size;

    // フェーズ3: 残レース（BC 中間除外後）のスロット圧力からパターン数（繰り下げ）を算出する
    // 各レースのウェイト = 1 / 使用可能スロット数（BC 制限スロットを除外）
    const slotPressure = new Map<string, number>();
    for (const race of racesToAssign) {
      const availableSlots = getAvailableSlots(race).filter(
        (s) => !isBCRestrictedSlot(s.grade, s.month, s.half),
      );
      if (availableSlots.length === 0) continue;
      const weight = 1.0 / availableSlots.length;
      for (const slot of availableSlots) {
        const key = sk(slot.grade, slot.month, slot.half);
        slotPressure.set(key, (slotPressure.get(key) ?? 0) + weight);
      }
    }
    const maxPressure = slotPressure.size > 0 ? Math.max(...slotPressure.values()) : 0;
    const nFromWeight = Math.floor(maxPressure);
    const N = Math.max(nBCFromIntermediate, nFromWeight);

    this.logger.debug({ nBCFromIntermediate, nFromWeight, N }, 'オーバーフロー: パターン数確定');

    if (N === 0) return [];

    // フェーズ4: N 個のパターンを初期化
    const grid: Map<string, RaceRow>[] = Array.from({ length: N }, () => new Map());
    const patternStrategies: (Record<string, number> | null)[] = Array(N).fill(null);
    const aptitudeStates: AptitudeState[] = Array.from({ length: N }, () => buildAptitudeState(umaData));

    // 先頭 nBCFromIntermediate 個: A パターン（補修あり）→ B パターン（補修なし）の順にソート
    const sortedBCFinalNames = [...bcFinalNamesWithIntermediate].sort((a, b) => {
      const raceA = allBCFinalRaces.find((r) => r.race_name === a);
      const raceB = allBCFinalRaces.find((r) => r.race_name === b);
      const stratA = raceA ? calcBCStrategy(raceA, umaData) : null;
      const stratB = raceB ? calcBCStrategy(raceB, umaData) : null;
      if (stratA && !stratB) return -1;
      if (!stratA && stratB) return 1;
      return 0;
    });

    // BC 最終・中間レースをグリッドに設定し、因子戦略・適性を更新
    // sortedBCRacesForAssign は assignRacesToBCGrids に渡す（nBCFromIntermediate 個のみ。超過インデックスは undefined）
    const sortedBCRacesForAssign: (RaceRow | undefined)[] = [];
    for (let i = 0; i < nBCFromIntermediate; i++) {
      const bcFinalName = sortedBCFinalNames[i];
      const bcRace = allBCFinalRaces.find((r) => r.race_name === bcFinalName);
      sortedBCRacesForAssign.push(bcRace);
      if (!bcRace) continue;

      grid[i].set(bcFinalKey, bcRace);
      for (const [grade, raceName, month, half] of BC_MANDATORY[bcFinalName] ?? []) {
        const slotK = sk(grade, month, half);
        if (grid[i].has(slotK)) continue;
        const race = allBCMandatoryRaces.find((r) => r.race_name === raceName);
        if (race) grid[i].set(slotK, race);
      }
      const strategy = calcBCStrategy(bcRace, umaData);
      patternStrategies[i] = strategy;
      if (strategy) {
        aptitudeStates[i] = applyStrategyToAptitude(buildAptitudeState(umaData), strategy);
      }
    }
    // 残りパターン（index >= nBCFromIntermediate）: 因子戦略 null・初期適性状態（初期化済み）

    // フェーズ5: assignRacesToBCGrids で全パターンへ残レースを一括割り当て
    // 既にレースが設定されているスロット（BC 最終・中間）は grid[pi].has(slotK) で自動スキップされる
    this.assignRacesToBCGrids(
      N, sortedBCRacesForAssign, grid, patternStrategies, aptitudeStates, racesToAssign, umaData,
    );

    // フェーズ6: BC シナリオ未設定パターンに現在の適性状態で走れる BC シナリオを設定する
    for (let i = nBCFromIntermediate; i < N; i++) {
      const runnable = allBCFinalRaces.find((bc) => isRaceRunnable(bc, aptitudeStates[i]));
      if (runnable) {
        grid[i].set(bcFinalKey, runnable);
        patternStrategies[i] = calcBCStrategy(runnable, umaData);
      }
    }

    return grid.map((g, i) => ({
      grid: g,
      strategy: patternStrategies[i],
      aptState: aptitudeStates[i],
    }));
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
    aptitudeStates: AptitudeState[],
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
