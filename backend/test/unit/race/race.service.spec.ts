import { RaceService } from '@src/race/race.service';
import type { RaceRow } from '@src/race/race.types';

/**
 * 対象: src/race/race.service.ts
 */

/** テスト用RaceRowを生成するヘルパー */
function makeRace(overrides: Partial<RaceRow> = {}): RaceRow {
  return {
    race_id: 1,
    race_name: 'テストG1',
    race_state: 0,
    distance: 3,
    distance_detail: null,
    num_fans: 10000,
    race_months: 5,
    half_flag: true,
    race_rank: 1,
    junior_flag: false,
    classic_flag: true,
    senior_flag: false,
    scenario_flag: false,
    ...overrides,
  };
}

/** テスト用ウマ娘行を生成するヘルパー */
function makeUmamusume(overrides: any = {}) {
  return {
    umamusume_id: 1,
    umamusume_name: 'テスト馬',
    turf_aptitude: 'A',
    dirt_aptitude: 'B',
    ...overrides,
  };
}

describe('RaceService', () => {
  let service: RaceService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      raceTable: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      registUmamusumeTable: {
        findMany: jest.fn(),
      },
      registUmamusumeRaceTable: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
      },
    };

    service = new RaceService(mockPrisma);
  });

  // ─────────────────────────────────────────────
  // getRaceList
  // ─────────────────────────────────────────────
  describe('getRaceList', () => {
    it('フィルタなし(state=-1, distance=-1)でfindManyをrace_rankフィルタのみで呼ぶ', async () => {
      const mockRaces = [makeRace({ race_id: 1 }), makeRace({ race_id: 2 })];
      mockPrisma.raceTable.findMany.mockResolvedValue(mockRaces);

      const result = await service.getRaceList(-1, -1);

      expect(mockPrisma.raceTable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { race_rank: { in: [1, 2, 3] } } }),
      );
      expect(result).toEqual(mockRaces);
    });

    it('state=0(芝)フィルタでrace_state=0を含むwhereで呼ぶ', async () => {
      mockPrisma.raceTable.findMany.mockResolvedValue([]);

      await service.getRaceList(0, -1);

      expect(mockPrisma.raceTable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { race_rank: { in: [1, 2, 3] }, race_state: 0 } }),
      );
    });

    it('distance=2(マイル)フィルタでdistance=2を含むwhereで呼ぶ', async () => {
      mockPrisma.raceTable.findMany.mockResolvedValue([]);

      await service.getRaceList(-1, 2);

      expect(mockPrisma.raceTable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { race_rank: { in: [1, 2, 3] }, distance: 2 } }),
      );
    });

    it('state=1かつdistance=3の複合フィルタで正しいwhereで呼ぶ', async () => {
      mockPrisma.raceTable.findMany.mockResolvedValue([]);

      await service.getRaceList(1, 3);

      expect(mockPrisma.raceTable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { race_rank: { in: [1, 2, 3] }, race_state: 1, distance: 3 } }),
      );
    });
  });

  // ─────────────────────────────────────────────
  // getRegistRaceList
  // ─────────────────────────────────────────────
  describe('getRegistRaceList', () => {
    it('G1/G2/G3レース一覧を返す', async () => {
      const mockRaces = [makeRace({ race_rank: 1 }), makeRace({ race_id: 2, race_rank: 2 })];
      mockPrisma.raceTable.findMany.mockResolvedValue(mockRaces);

      const result = await service.getRegistRaceList();

      expect(mockPrisma.raceTable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { race_rank: { in: [1, 2, 3] } },
        }),
      );
      expect(result).toEqual(mockRaces);
    });
  });

  // ─────────────────────────────────────────────
  // getRemaining
  // ─────────────────────────────────────────────
  describe('getRemaining', () => {
    const userId = 'user-001';

    it('登録ウマ娘が存在しない場合 → 空配列を返す', async () => {
      mockPrisma.registUmamusumeTable.findMany.mockResolvedValue([]);
      mockPrisma.raceTable.findMany.mockResolvedValue([makeRace()]);
      mockPrisma.registUmamusumeRaceTable.findMany.mockResolvedValue([]);

      const result = await service.getRemaining(userId);

      expect(result).toEqual([]);
    });

    it('残レースが0件の場合 → isAllCrownがtrueになる', async () => {
      const umamusume = makeUmamusume();
      mockPrisma.registUmamusumeTable.findMany.mockResolvedValue([
        { umamusume_id: 1, user_id: userId, umamusume },
      ]);
      mockPrisma.raceTable.findMany.mockResolvedValue([makeRace({ race_id: 101 })]);
      // 全レース出走済み
      mockPrisma.registUmamusumeRaceTable.findMany.mockResolvedValue([
        { umamusume_id: 1, race_id: 101 },
      ]);

      const result = await service.getRemaining(userId);

      expect(result).toHaveLength(1);
      expect(result[0].isAllCrown).toBe(true);
      expect(result[0].allCrownRace).toBe(0);
    });

    it('残レースがある場合 → isAllCrownがfalseでカウントが正しい', async () => {
      const umamusume = makeUmamusume();
      mockPrisma.registUmamusumeTable.findMany.mockResolvedValue([
        { umamusume_id: 1, user_id: userId, umamusume },
      ]);

      const targetRaces = [
        makeRace({ race_id: 101, race_state: 0, distance: 3 }),
        makeRace({ race_id: 102, race_state: 1, distance: 2, race_months: 8, half_flag: false }),
      ];
      mockPrisma.raceTable.findMany.mockResolvedValue(targetRaces);
      mockPrisma.registUmamusumeRaceTable.findMany.mockResolvedValue([]);

      const result = await service.getRemaining(userId);

      expect(result).toHaveLength(1);
      expect(result[0].isAllCrown).toBe(false);
      expect(result[0].allCrownRace).toBe(2);
      expect(result[0].turfClassicRace).toBe(1);
      expect(result[0].dirtMileRace).toBe(1);
    });

    it('複数ウマ娘が存在する場合 → allCrownRace昇順でソートされる', async () => {
      const uma1 = makeUmamusume({ umamusume_id: 1, umamusume_name: 'ゼッキー' });
      const uma2 = makeUmamusume({ umamusume_id: 2, umamusume_name: 'スペ' });

      mockPrisma.registUmamusumeTable.findMany.mockResolvedValue([
        { umamusume_id: 1, user_id: userId, umamusume: uma1 },
        { umamusume_id: 2, user_id: userId, umamusume: uma2 },
      ]);

      const allTargetRaces = [
        makeRace({ race_id: 101 }),
        makeRace({ race_id: 102, race_months: 7 }),
        makeRace({ race_id: 103, race_months: 9 }),
      ];
      mockPrisma.raceTable.findMany.mockResolvedValue(allTargetRaces);

      // uma2は2レース出走済み → 残1件、uma1は未出走 → 残3件
      mockPrisma.registUmamusumeRaceTable.findMany.mockResolvedValue([
        { umamusume_id: 2, race_id: 101 },
        { umamusume_id: 2, race_id: 102 },
      ]);

      const result = await service.getRemaining(userId);

      expect(result[0].umamusume.umamusume_id).toBe(2); // 残1件が先
      expect(result[1].umamusume.umamusume_id).toBe(1); // 残3件が後
    });
  });

  // ─────────────────────────────────────────────
  // registerOne
  // ─────────────────────────────────────────────
  describe('registerOne', () => {
    const userId = 'user-001';
    const umamusumeId = 1;

    it('既に出走済みの場合 → 「既に出走済み」メッセージを返す', async () => {
      const race = { race_id: 10, race_name: '日本ダービー' };
      mockPrisma.registUmamusumeRaceTable.findFirst.mockResolvedValue({ id: 99 });

      const result = await service.registerOne(userId, umamusumeId, race);

      expect(result).toEqual({ message: '日本ダービーは既に出走済みです。' });
      expect(mockPrisma.registUmamusumeRaceTable.create).not.toHaveBeenCalled();
    });

    it('未出走の場合 → レコードを作成して登録メッセージを返す', async () => {
      const race = { race_id: 10, race_name: '天皇賞秋' };
      mockPrisma.registUmamusumeRaceTable.findFirst.mockResolvedValue(null);
      mockPrisma.registUmamusumeRaceTable.create.mockResolvedValue({});

      const result = await service.registerOne(userId, umamusumeId, race);

      expect(mockPrisma.registUmamusumeRaceTable.create).toHaveBeenCalledWith({
        data: { user_id: userId, umamusume_id: umamusumeId, race_id: 10 },
      });
      expect(result).toEqual({ message: '天皇賞秋を出走登録しました。' });
    });

    it('race_nameがない場合 → IDをフォールバックとして使う', async () => {
      const race = { race_id: 5 };
      mockPrisma.registUmamusumeRaceTable.findFirst.mockResolvedValue({ id: 99 });

      const result = await service.registerOne(userId, umamusumeId, race);

      expect(result).toEqual({ message: 'ID:5は既に出走済みです。' });
    });
  });

  // ─────────────────────────────────────────────
  // raceRun
  // ─────────────────────────────────────────────
  describe('raceRun', () => {
    it('レコードを作成して出走完了メッセージを返す', async () => {
      mockPrisma.registUmamusumeRaceTable.create.mockResolvedValue({});

      const result = await service.raceRun('user-001', 1, 42);

      expect(mockPrisma.registUmamusumeRaceTable.create).toHaveBeenCalledWith({
        data: { user_id: 'user-001', umamusume_id: 1, race_id: 42 },
      });
      expect(result).toEqual({ message: '出走完了' });
    });
  });

  // ─────────────────────────────────────────────
  // registerPattern
  // ─────────────────────────────────────────────
  describe('registerPattern', () => {
    it('複数レースをcreateMany(skipDuplicates)で一括登録する', async () => {
      mockPrisma.registUmamusumeRaceTable.createMany.mockResolvedValue({ count: 3 });

      const races = [
        { race_id: 1 },
        { race_id: 2 },
        { race_id: 3 },
      ];
      const result = await service.registerPattern('user-001', 1, races);

      expect(mockPrisma.registUmamusumeRaceTable.createMany).toHaveBeenCalledWith({
        data: [
          { user_id: 'user-001', umamusume_id: 1, race_id: 1 },
          { user_id: 'user-001', umamusume_id: 1, race_id: 2 },
          { user_id: 'user-001', umamusume_id: 1, race_id: 3 },
        ],
        skipDuplicates: true,
      });
      expect(result).toEqual({ message: 'レースパターンを登録しました。' });
    });

    it('空配列を渡した場合 → createManyをdata=[]で呼ぶ', async () => {
      mockPrisma.registUmamusumeRaceTable.createMany.mockResolvedValue({ count: 0 });

      const result = await service.registerPattern('user-001', 1, []);

      expect(mockPrisma.registUmamusumeRaceTable.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: [] }),
      );
      expect(result).toEqual({ message: 'レースパターンを登録しました。' });
    });
  });

  // ─────────────────────────────────────────────
  // getRemainingToRace
  // ─────────────────────────────────────────────
  describe('getRemainingToRace', () => {
    const userId = 'user-001';
    const umamusumeId = 1;

    it('指定月に残レースがある場合 → そのレースを含む結果を返す', async () => {
      const raceInSlot = makeRace({
        race_id: 10,
        race_months: 5,
        half_flag: true,
        race_rank: 1,
        classic_flag: true,
        junior_flag: false,
        senior_flag: false,
      });

      mockPrisma.registUmamusumeRaceTable.findMany
        // 出走済みレース取得（最初の呼び出し）
        .mockResolvedValueOnce([])
        // hasRaceBefore と hasRaceAfter の count クエリ用
      mockPrisma.raceTable.findMany.mockResolvedValue([raceInSlot]);
      mockPrisma.raceTable.count.mockResolvedValue(0);

      const result = await service.getRemainingToRace(userId, umamusumeId, 2, 5, true);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('Props');
      expect(result.Props.season).toBe(2);
      expect(result.Props.month).toBe(5);
      expect(result.Props.half).toBe(true);
    });

    it('指定月に残レースがない場合 → 次のスロットを探索する', async () => {
      mockPrisma.registUmamusumeRaceTable.findMany.mockResolvedValue([]);
      // 最初のfindMany(指定月)は空、次のスロットは空
      mockPrisma.raceTable.findMany.mockResolvedValue([]);
      mockPrisma.raceTable.count.mockResolvedValue(0);

      const result = await service.getRemainingToRace(userId, umamusumeId, 2, 12, true);

      expect(result.data).toEqual([]);
    });
  });
});
