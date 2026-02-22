import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service.js';

/** レース関連のビジネスロジックを提供するサービス */
@Injectable()
export class RaceService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /** レース一覧取得 (フィルタ付き)
   * @param state - 馬場フィルタ（0=芝, 1=ダート, -1=全て）
   * @param distance - 距離フィルタ（1~4, -1=全て）
   * @returns フィルタされたレース一覧
   */
  async getRaceList(state: number, distance: number) {
    const where: any = { race_rank: { in: [1, 2, 3] } };
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

    // ユーザーの出走済みレースを取得
    const umamusumeIds = registUmamusumes.map((r) => r.umamusume_id);
    const runRaces = await this.prisma.registUmamusumeRaceTable.findMany({
      where: {
        user_id: userId,
        ...(umamusumeIds.length > 0
          ? { umamusume_id: { in: umamusumeIds } }
          : { umamusume_id: 0 }),
      },
      select: { umamusume_id: true, race_id: true },
    });

    // ウマ娘IDごとに出走済みレースIDをマッピング
    const runRacesByUmamusume: Record<number, number[]> = {};
    for (const item of runRaces) {
      if (!runRacesByUmamusume[item.umamusume_id]) {
        runRacesByUmamusume[item.umamusume_id] = [];
      }
      runRacesByUmamusume[item.umamusume_id].push(item.race_id);
    }

    const results: any[] = [];

    for (const regist of registUmamusumes) {
      const registRaceIds = runRacesByUmamusume[regist.umamusume_id] || [];
      const remainingRaces = targetRaces.filter(
        (r) => !registRaceIds.includes(r.race_id),
      );
      const isAllCrown = remainingRaces.length === 0;

      const counts = {
        allCrownRace: 0,
        turfSprintRace: 0,
        turfMileRace: 0,
        turfClassicRace: 0,
        turfLongDistanceRace: 0,
        dirtSprintDistanceRace: 0,
        dirtMileRace: 0,
        dirtClassicRace: 0,
      };

      if (!isAllCrown) {
        counts.allCrownRace = remainingRaces.length;
        for (const race of remainingRaces) {
          if (race.race_state === 0 && race.distance === 1)
            counts.turfSprintRace++;
          if (race.race_state === 0 && race.distance === 2)
            counts.turfMileRace++;
          if (race.race_state === 0 && race.distance === 3)
            counts.turfClassicRace++;
          if (race.race_state === 0 && race.distance === 4)
            counts.turfLongDistanceRace++;
          if (race.race_state === 1 && race.distance === 1)
            counts.dirtSprintDistanceRace++;
          if (race.race_state === 1 && race.distance === 2)
            counts.dirtMileRace++;
          if (race.race_state === 1 && race.distance === 3)
            counts.dirtClassicRace++;
        }
      }

      results.push({
        umamusume: regist.umamusume,
        isAllCrown,
        ...counts,
      });
    }

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

    props.isRaceReturn = await this.hasRaceBefore(registRaceIds, props);
    props.isRaceForward = await this.hasRaceAfter(registRaceIds, props);

    return { data: races || [], Props: props };
  }

  /** 出走登録 (1件)
   * @param userId - ユーザーID
   * @param umamusumeId - 対象ウマ娘ID
   * @param race - 登録するレース情報
   * @returns 登録結果メッセージ
   */
  async registerOne(userId: string, umamusumeId: number, race: any) {
    const raceId = race.race_id;
    const raceName = race.race_name || `ID:${raceId}`;

    // 既存チェック
    const existing = await this.prisma.registUmamusumeRaceTable.findFirst({
      where: { user_id: userId, umamusume_id: umamusumeId, race_id: raceId },
      select: { id: true },
    });

    if (existing) {
      return { message: `${raceName}は既に出走済みです。` };
    }

    await this.prisma.registUmamusumeRaceTable.create({
      data: { user_id: userId, umamusume_id: umamusumeId, race_id: raceId },
    });

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

    return { message: '出走完了' };
  }

  /** パターン一括出走登録
   * @param userId - ユーザーID
   * @param umamusumeId - 対象ウマ娘ID
   * @param races - 一括登録するレース情報の配列
   * @returns 登録結果メッセージ
   */
  async registerPattern(userId: string, umamusumeId: number, races: any[]) {
    const records = races
      .filter((race) => race.race_id != null)
      .map((race) => ({
        user_id: userId,
        umamusume_id: umamusumeId,
        race_id: race.race_id,
      }));

    await this.prisma.registUmamusumeRaceTable.createMany({
      data: records,
      skipDuplicates: true,
    });

    return { message: 'レースパターンを登録しました。' };
  }

  // --- Private helpers ---

  /** 指定月・前後半・時期の残レースをDBから取得する
   * @param registRaceIds - 出走済みレースIDの配列
   * @param season - 時期（1~3）
   * @param month - 月（1~12）
   * @param half - 後半フラグ
   * @returns 残レースの配列
   */
  private async findRemainingRaces(
    registRaceIds: number[],
    season: number,
    month: number,
    half: boolean,
  ) {
    const seasonWhere =
      season === 1
        ? { junior_flag: true }
        : season === 2
          ? { classic_flag: true }
          : { senior_flag: true };

    const data = await this.prisma.raceTable.findMany({
      where: {
        race_rank: { in: [1, 2, 3] },
        race_months: month,
        half_flag: half,
        ...(registRaceIds.length > 0
          ? { race_id: { notIn: registRaceIds } }
          : {}),
        ...seasonWhere,
      },
    });

    return data;
  }

  /** 指定スロットより前に未出走レースが存在するか確認する
   * @param registRaceIds - 出走済みレースIDの配列
   * @param props - 現在の時期・月・前後半
   * @returns 前スロットに残レースがある場合 true
   */
  private async hasRaceBefore(
    registRaceIds: number[],
    props: { season: number; month: number; half: boolean },
  ): Promise<boolean> {
    const notInFilter =
      registRaceIds.length > 0 ? { notIn: registRaceIds } : undefined;

    for (let s = props.season; s >= 1; s--) {
      const seasonWhere =
        s === 1
          ? { junior_flag: true }
          : s === 2
            ? { classic_flag: true }
            : { senior_flag: true };

      if (s === props.season) {
        if (props.half) {
          const count = await this.prisma.raceTable.count({
            where: {
              race_rank: { in: [1, 2, 3] },
              ...seasonWhere,
              race_months: props.month,
              half_flag: false,
              ...(notInFilter ? { race_id: notInFilter } : {}),
            },
          });
          if (count > 0) return true;
        }

        const count = await this.prisma.raceTable.count({
          where: {
            race_rank: { in: [1, 2, 3] },
            ...seasonWhere,
            race_months: { lt: props.month },
            ...(notInFilter ? { race_id: notInFilter } : {}),
          },
        });
        if (count > 0) return true;
      } else {
        const count = await this.prisma.raceTable.count({
          where: {
            race_rank: { in: [1, 2, 3] },
            ...seasonWhere,
            ...(notInFilter ? { race_id: notInFilter } : {}),
          },
        });
        if (count > 0) return true;
      }
    }
    return false;
  }

  /** 指定スロットより後に未出走レースが存在するか確認する
   * @param registRaceIds - 出走済みレースIDの配列
   * @param props - 現在の時期・月・前後半
   * @returns 後スロットに残レースがある場合 true
   */
  private async hasRaceAfter(
    registRaceIds: number[],
    props: { season: number; month: number; half: boolean },
  ): Promise<boolean> {
    const notInFilter =
      registRaceIds.length > 0 ? { notIn: registRaceIds } : undefined;

    for (let s = props.season; s <= 3; s++) {
      const seasonWhere =
        s === 1
          ? { junior_flag: true }
          : s === 2
            ? { classic_flag: true }
            : { senior_flag: true };

      if (s === props.season) {
        if (!props.half) {
          const count = await this.prisma.raceTable.count({
            where: {
              race_rank: { in: [1, 2, 3] },
              ...seasonWhere,
              race_months: props.month,
              half_flag: true,
              ...(notInFilter ? { race_id: notInFilter } : {}),
            },
          });
          if (count > 0) return true;
        }

        const count = await this.prisma.raceTable.count({
          where: {
            race_rank: { in: [1, 2, 3] },
            ...seasonWhere,
            race_months: { gt: props.month },
            ...(notInFilter ? { race_id: notInFilter } : {}),
          },
        });
        if (count > 0) return true;
      } else {
        const count = await this.prisma.raceTable.count({
          where: {
            race_rank: { in: [1, 2, 3] },
            ...seasonWhere,
            ...(notInFilter ? { race_id: notInFilter } : {}),
          },
        });
        if (count > 0) return true;
      }
    }
    return false;
  }
}
