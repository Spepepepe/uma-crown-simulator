import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service.js';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Prisma } from '@prisma/client';
import type { RaceInput, RemainingRaceEntry } from './race.types.js';

/** 馬場×距離 → カウントキーの対応表 */
const CATEGORY_KEY_MAP: Record<string, keyof RemainingRaceCounts> = {
  '0-1': 'turfSprintRace',
  '0-2': 'turfMileRace',
  '0-3': 'turfClassicRace',
  '0-4': 'turfLongDistanceRace',
  '1-1': 'dirtSprintDistanceRace',
  '1-2': 'dirtMileRace',
  '1-3': 'dirtClassicRace',
};

/** カテゴリ別レース数の型 */
type RemainingRaceCounts = {
  allCrownRace: number;
  turfSprintRace: number;
  turfMileRace: number;
  turfClassicRace: number;
  turfLongDistanceRace: number;
  dirtSprintDistanceRace: number;
  dirtMileRace: number;
  dirtClassicRace: number;
};

/** 時期番号を Prisma where 条件に変換する */
function seasonToWhere(season: number): Prisma.RaceTableWhereInput {
  if (season === 1) return { junior_flag: true };
  if (season === 2) return { classic_flag: true };
  return { senior_flag: true };
}

/** レース関連のビジネスロジックを提供するサービス */
@Injectable()
export class RaceService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(RaceService.name) private readonly logger: PinoLogger,
  ) {}

  // ─── Queries ────────────────────────────────────────────────────

  /** レース一覧取得 (フィルタ付き)
   * @param state - 馬場フィルタ（0=芝, 1=ダート, -1=全て）
   * @param distance - 距離フィルタ（1~4, -1=全て）
   * @returns フィルタされたレース一覧
   */
  async getRaceList(state: number, distance: number) {
    const where: Prisma.RaceTableWhereInput = { race_rank: { in: [1, 2, 3] } };
    if (state !== -1) where.race_state = state;
    if (distance !== -1) where.distance = distance;

    return this.prisma.raceTable.findMany({
      where,
      orderBy: [
        { race_rank: 'asc' },
        { junior_flag: 'desc' },
        { classic_flag: 'desc' },
        { race_months: 'asc' },
        { half_flag: 'asc' },
      ],
    });
  }

  /** 登録用レースリスト取得 (G1/G2/G3)
   * @returns G1~G3レースの一覧（ID順）
   */
  async getRegistRaceList() {
    return this.prisma.raceTable.findMany({
      where: { race_rank: { in: [1, 2, 3] } },
      orderBy: { race_id: 'asc' },
    });
  }

  /** 残レース一覧取得
   * @param userId - ユーザーID
   * @returns 登録済みウマ娘ごとの残レース数・育成目安回数などの情報
   */
  async getRemaining(userId: string) {
    // ユーザー登録済みウマ娘を取得
    const registUmamusumes = await this.prisma.registUmamusumeTable.findMany({
      where: { user_id: userId },
      include: { umamusume: true },
    });

    // G1/G2/G3 レースを取得
    const targetRaces = await this.prisma.raceTable.findMany({
      where: { race_rank: { in: [1, 2, 3] } },
    });

    // ウマ娘IDごとに出走済みレースIDをマッピング
    const runRacesByUmamusume = await this.buildRunRaceMap(
      userId,
      registUmamusumes.map((r) => r.umamusume_id),
    );

    const results: RemainingRaceEntry[] = registUmamusumes.map((regist) => {
      const registRaceIds = runRacesByUmamusume[regist.umamusume_id] || [];
      const remainingRaces = targetRaces.filter(
        (r) => !registRaceIds.includes(r.race_id),
      );
      return {
        umamusume: regist.umamusume,
        isAllCrown: remainingRaces.length === 0,
        ...this.countRemainingByCategory(remainingRaces),
      };
    });

    // allCrownRace昇順 → ウマ娘名昇順でソート
    results.sort((a, b) => {
      if (a.allCrownRace !== b.allCrownRace)
        return a.allCrownRace - b.allCrownRace;
      return a.umamusume.umamusume_name.localeCompare(
        b.umamusume.umamusume_name,
      );
    });

    return results;
  }

  /** 月別残レース取得
   * @param userId - ユーザーID
   * @param umamusumeId - 対象ウマ娘ID
   * @param season - 時期（1=ジュニア, 2=クラシック, 3=シニア）
   * @param month - 月（1~12）
   * @param half - 後半フラグ（true=後半, false=前半）
   * @returns 残レース一覧と前後ページ有無のフラグ
   */
  async getRemainingToRace(
    userId: string,
    umamusumeId: number,
    season: number,
    month: number,
    half: boolean,
  ) {
    // 出走済みレースIDを取得
    const registRaces = await this.prisma.registUmamusumeRaceTable.findMany({
      where: { user_id: userId, umamusume_id: umamusumeId },
      select: { race_id: true },
    });

    const registRaceIds = registRaces.map((r) => r.race_id);

    const props = {
      season,
      month,
      half,
      isRaceReturn: false,
      isRaceForward: false,
    };

    let races = await this.findRemainingRaces(
      registRaceIds,
      season,
      month,
      half,
    );

    // 該当レースがなければ次のスロットを探索
    let loopCount = 0;
    while ((!races || races.length === 0) && loopCount < 2) {
      const secondHalf = !half;
      let secondMonth = month;
      let secondSeason = season;

      if (half) {
        secondMonth = month + 1;
        if (month === 12) {
          secondMonth = 1;
          if (season < 3) secondSeason = season + 1;
        }
      }

      props.season = secondSeason;
      props.month = secondMonth;
      props.half = secondHalf;

      races = await this.findRemainingRaces(
        registRaceIds,
        secondSeason,
        secondMonth,
        secondHalf,
      );
      loopCount++;
    }

    props.isRaceReturn = await this.hasRaceInDirection(
      registRaceIds,
      props,
      'before',
    );
    props.isRaceForward = await this.hasRaceInDirection(
      registRaceIds,
      props,
      'after',
    );

    return { data: races || [], Props: props };
  }

  /** 指定ウマ娘の出走済みレース一覧を取得
   * @param userId - ユーザーID
   * @param umamusumeId - 対象ウマ娘ID
   * @returns 出走済みレースの一覧（race_id昇順）
   */
  async getRunRaces(userId: string, umamusumeId: number) {
    const rows = await this.prisma.registUmamusumeRaceTable.findMany({
      where: {
        user_id: userId,
        umamusume_id: umamusumeId,
        race: { race_rank: { in: [1, 2, 3] } },
      },
      include: { race: true },
      orderBy: { race_id: 'asc' },
    });
    return rows.map((r) => r.race);
  }

  // ─── Commands ───────────────────────────────────────────────────

  /** 出走済みレースを取り消す
   * @param userId - ユーザーID
   * @param umamusumeId - 対象ウマ娘ID
   * @param raceIds - 取り消すレースIDの配列
   * @returns 取り消し結果メッセージ
   */
  async cancelRunRaces(userId: string, umamusumeId: number, raceIds: number[]) {
    await this.prisma.registUmamusumeRaceTable.deleteMany({
      where: {
        user_id: userId,
        umamusume_id: umamusumeId,
        race_id: { in: raceIds },
      },
    });
    this.logger.info(
      { userId, umamusumeId, count: raceIds.length },
      '出走取り消し完了',
    );
    return { message: '出走を取り消しました' };
  }

  /** 出走登録 (1件)
   * @param userId - ユーザーID
   * @param umamusumeId - 対象ウマ娘ID
   * @param race - 登録するレース情報
   * @returns 登録結果メッセージ
   */
  async registerOne(userId: string, umamusumeId: number, race: RaceInput) {
    const raceId = race.race_id;
    const raceName = race.race_name || `ID:${raceId}`;

    // 既存チェック
    const existing = await this.prisma.registUmamusumeRaceTable.findFirst({
      where: { user_id: userId, umamusume_id: umamusumeId, race_id: raceId },
      select: { id: true },
    });

    if (existing) {
      this.logger.debug(
        { userId, umamusumeId, raceId, raceName },
        '出走登録スキップ: 既に出走済み',
      );
      return { message: `${raceName}は既に出走済みです。` };
    }

    await this.prisma.registUmamusumeRaceTable.create({
      data: { user_id: userId, umamusume_id: umamusumeId, race_id: raceId },
    });

    this.logger.info({ userId, umamusumeId, raceId, raceName }, '出走登録完了');
    return { message: `${raceName}を出走登録しました。` };
  }

  /** 出走登録
   * @param userId - ユーザーID
   * @param umamusumeId - 対象ウマ娘ID
   * @param raceId - 出走するレースID
   * @returns 完了メッセージ
   */
  async raceRun(userId: string, umamusumeId: number, raceId: number) {
    await this.prisma.registUmamusumeRaceTable.create({
      data: { user_id: userId, umamusume_id: umamusumeId, race_id: raceId },
    });

    this.logger.info({ userId, umamusumeId, raceId }, '出走完了');
    return { message: '出走完了' };
  }

  /** パターン一括出走登録
   * @param userId - ユーザーID
   * @param umamusumeId - 対象ウマ娘ID
   * @param races - 一括登録するレース情報の配列
   * @returns 登録結果メッセージ
   */
  async registerPattern(
    userId: string,
    umamusumeId: number,
    races: RaceInput[],
  ) {
    const records = races
      .filter((race) => race.race_id != null)
      .map((race) => ({
        user_id: userId,
        umamusume_id: umamusumeId,
        race_id: race.race_id,
      }));

    this.logger.info(
      { userId, umamusumeId, count: records.length },
      'パターン一括登録',
    );
    await this.prisma.registUmamusumeRaceTable.createMany({
      data: records,
      skipDuplicates: true,
    });

    return { message: 'レースパターンを登録しました。' };
  }

  // ─── Private helpers ────────────────────────────────────────────

  /** ウマ娘IDごとの出走済みレースIDマップを構築する */
  private async buildRunRaceMap(
    userId: string,
    umamusumeIds: number[],
  ): Promise<Record<number, number[]>> {
    const runRaces = await this.prisma.registUmamusumeRaceTable.findMany({
      where: {
        user_id: userId,
        ...(umamusumeIds.length > 0
          ? { umamusume_id: { in: umamusumeIds } }
          : { umamusume_id: 0 }),
      },
      select: { umamusume_id: true, race_id: true },
    });

    const map: Record<number, number[]> = {};
    for (const item of runRaces) {
      if (!map[item.umamusume_id]) {
        map[item.umamusume_id] = [];
      }
      map[item.umamusume_id].push(item.race_id);
    }
    return map;
  }

  /** 残レースをカテゴリ別にカウントする */
  private countRemainingByCategory(
    remainingRaces: { race_state: number; distance: number }[],
  ): RemainingRaceCounts {
    const counts: RemainingRaceCounts = {
      allCrownRace: remainingRaces.length,
      turfSprintRace: 0,
      turfMileRace: 0,
      turfClassicRace: 0,
      turfLongDistanceRace: 0,
      dirtSprintDistanceRace: 0,
      dirtMileRace: 0,
      dirtClassicRace: 0,
    };

    for (const race of remainingRaces) {
      const key = CATEGORY_KEY_MAP[`${race.race_state}-${race.distance}`];
      if (key) counts[key]++;
    }
    return counts;
  }

  /** 指定月・前後半・時期の残レースをDBから取得する */
  private async findRemainingRaces(
    registRaceIds: number[],
    season: number,
    month: number,
    half: boolean,
  ) {
    return this.prisma.raceTable.findMany({
      where: {
        race_rank: { in: [1, 2, 3] },
        race_months: month,
        half_flag: half,
        ...(registRaceIds.length > 0
          ? { race_id: { notIn: registRaceIds } }
          : {}),
        ...seasonToWhere(season),
      },
    });
  }

  /** 指定スロットの前方または後方に未出走レースが存在するか確認する */
  private async hasRaceInDirection(
    registRaceIds: number[],
    props: { season: number; month: number; half: boolean },
    direction: 'before' | 'after',
  ): Promise<boolean> {
    const notInFilter =
      registRaceIds.length > 0 ? { notIn: registRaceIds } : undefined;
    const isBefore = direction === 'before';
    const startSeason = isBefore ? props.season : props.season;
    const endSeason = isBefore ? 1 : 3;
    const step = isBefore ? -1 : 1;

    for (
      let s = startSeason;
      isBefore ? s >= endSeason : s <= endSeason;
      s += step
    ) {
      if (await this.hasRaceInSeason(s, props, notInFilter, direction)) {
        return true;
      }
    }
    return false;
  }

  /** 特定シーズン内で指定方向に残レースがあるか確認する */
  private async hasRaceInSeason(
    season: number,
    props: { season: number; month: number; half: boolean },
    notInFilter: { notIn: number[] } | undefined,
    direction: 'before' | 'after',
  ): Promise<boolean> {
    const seasonWhere = seasonToWhere(season);
    const baseWhere: Prisma.RaceTableWhereInput = {
      race_rank: { in: [1, 2, 3] },
      ...seasonWhere,
      ...(notInFilter ? { race_id: notInFilter } : {}),
    };

    if (season !== props.season) {
      return (await this.prisma.raceTable.count({ where: baseWhere })) > 0;
    }

    // 同じシーズン内: 同月の反対半期をチェック
    const checkSameMonth = direction === 'before' ? props.half : !props.half;
    if (checkSameMonth) {
      const halfFlag = direction === 'before' ? false : true;
      const count = await this.prisma.raceTable.count({
        where: { ...baseWhere, race_months: props.month, half_flag: halfFlag },
      });
      if (count > 0) return true;
    }

    // 同じシーズン内: 前方/後方の月をチェック
    const monthFilter =
      direction === 'before' ? { lt: props.month } : { gt: props.month };
    return (
      (await this.prisma.raceTable.count({
        where: { ...baseWhere, race_months: monthFilter },
      })) > 0
    );
  }
}
