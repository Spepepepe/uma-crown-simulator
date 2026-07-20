import { SeedService } from '@src/seed/seed.service.js';
import { DatabaseException } from '@common/exceptions/database.exception.js';

/**
 * 対象: src/seed/seed.service.ts
 *
 * シードデータ投入の差分ロジック・シナリオエントリ処理・エラーハンドリングを検証する。
 * ファイル I/O は loadJsonFile を spy でモックし、DB は mockPrisma で差し替える。
 */

/** PrismaService のモック型 */
interface MockPrisma {
  raceTable: {
    findMany: jest.Mock;
    createMany: jest.Mock;
  };
  umamusumeTable: {
    findMany: jest.Mock;
    createMany: jest.Mock;
  };
  scenarioRaceTable: {
    findMany: jest.Mock;
    createMany: jest.Mock;
  };
}

/** PinoLogger のモック型 */
interface MockLogger {
  info: jest.Mock;
  debug: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}

describe('SeedService', () => {
  let service: SeedService;
  let mockPrisma: MockPrisma;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockPrisma = {
      raceTable: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      umamusumeTable: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      scenarioRaceTable: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    service = new SeedService(
      mockPrisma as unknown as ConstructorParameters<typeof SeedService>[0],
      mockLogger as unknown as ConstructorParameters<typeof SeedService>[1],
    );
  });

  /**
   * loadJsonFile を spy でモックするヘルパー。
   * private メソッドなので型アサーションで参照する。
   */
  function mockLoadJsonFile(
    returnValues: Record<string, unknown>,
  ): jest.SpyInstance {
    // キーを長い順にソートして、"UmamusumeScenario" が "Umamusume" より先にマッチするようにする
    const sortedEntries = Object.entries(returnValues).sort(
      ([a], [b]) => b.length - a.length,
    );

    return jest
      .spyOn(service as never, 'loadJsonFile' as never)
      .mockImplementation(((filePath: string) => {
        for (const [key, value] of sortedEntries) {
          if (filePath.includes(key)) return Promise.resolve(value);
        }
        return Promise.resolve({});
      }) as never);
  }

  // ─────────────────────────────────────────────
  // onModuleInit
  // ─────────────────────────────────────────────
  describe('onModuleInit', () => {
    it('3つの upsert メソッドを順番に呼び出す', async () => {
      mockLoadJsonFile({ Race: {}, Umamusume: {}, UmamusumeScenario: {} });

      await service.onModuleInit();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'マスタデータの差分チェックを開始します...',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'マスタデータの差分チェックが完了しました',
      );
    });
  });

  // ─────────────────────────────────────────────
  // upsertRaces
  // ─────────────────────────────────────────────
  describe('upsertRaces (via onModuleInit)', () => {
    it('DB に存在しない新規レースのみ createMany に渡す', async () => {
      mockLoadJsonFile({
        Race: {
          天皇賞春: {
            race_name: '天皇賞春',
            race_state: 0,
            distance: 4,
            distance_detail: 3200,
            num_fans: 15000,
            race_rank: 1,
            senior_flag: true,
            classic_flag: false,
            junior_flag: false,
            race_months: 4,
            half_flag: true,
            larc_flag: false,
            bc_flag: false,
          },
          既存レース: {
            race_name: '既存レース',
            race_state: 0,
            distance: 1,
            distance_detail: null,
            num_fans: 0,
            race_rank: 1,
            senior_flag: false,
            classic_flag: false,
            junior_flag: false,
            race_months: 1,
            half_flag: false,
            larc_flag: false,
            bc_flag: false,
          },
        },
        Umamusume: {},
        UmamusumeScenario: {},
      });

      // DB に「既存レース」が既に存在
      mockPrisma.raceTable.findMany.mockResolvedValue([
        { race_name: '既存レース' },
      ]);

      await service.onModuleInit();

      expect(mockPrisma.raceTable.createMany).toHaveBeenCalledTimes(1);
      const insertedData =
        mockPrisma.raceTable.createMany.mock.calls[0][0].data;
      expect(insertedData).toHaveLength(1);
      expect(insertedData[0].race_name).toBe('天皇賞春');
    });

    it('全レースが既に存在する場合 → createMany を呼ばない', async () => {
      mockLoadJsonFile({
        Race: {
          既存レース: {
            race_name: '既存レース',
            race_state: 0,
            distance: 1,
            distance_detail: null,
            num_fans: 0,
            race_rank: 1,
            senior_flag: false,
            classic_flag: false,
            junior_flag: false,
            race_months: 1,
            half_flag: false,
            larc_flag: false,
            bc_flag: false,
          },
        },
        Umamusume: {},
        UmamusumeScenario: {},
      });
      mockPrisma.raceTable.findMany.mockResolvedValue([
        { race_name: '既存レース' },
      ]);

      await service.onModuleInit();

      expect(mockPrisma.raceTable.createMany).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'race_table: 追加データなし',
      );
    });
  });

  // ─────────────────────────────────────────────
  // upsertUmamusume
  // ─────────────────────────────────────────────
  describe('upsertUmamusume (via onModuleInit)', () => {
    it('DB に存在しない新規ウマ娘のみ createMany に渡す', async () => {
      mockLoadJsonFile({
        Race: {},
        Umamusume: {
          ゴルシ: {
            umamusume_name: 'ゴルシ',
            turf_aptitude: 'A',
            dirt_aptitude: 'B',
            front_runner_aptitude: 'G',
            early_foot_aptitude: 'C',
            midfield_aptitude: 'A',
            closer_aptitude: 'A',
            sprint_aptitude: 'G',
            mile_aptitude: 'C',
            classic_aptitude: 'A',
            long_distance_aptitude: 'A',
          },
        },
        UmamusumeScenario: {},
      });
      mockPrisma.umamusumeTable.findMany.mockResolvedValue([]);

      await service.onModuleInit();

      expect(mockPrisma.umamusumeTable.createMany).toHaveBeenCalledTimes(1);
      const insertedData =
        mockPrisma.umamusumeTable.createMany.mock.calls[0][0].data;
      expect(insertedData[0].umamusume_name).toBe('ゴルシ');
    });
  });

  // ─────────────────────────────────────────────
  // upsertScenarioRaces
  // ─────────────────────────────────────────────
  describe('upsertScenarioRaces (via onModuleInit)', () => {
    /**
     * シナリオテストの共通セットアップ。
     * onModuleInit は upsertRaces → upsertUmamusume → upsertScenarioRaces の順で
     * findMany を呼ぶため、mockResolvedValueOnce で呼び出し順を制御する。
     */
    function setupScenarioMocks(
      scenarioData: Record<string, Record<string, unknown>>,
    ): void {
      mockLoadJsonFile({
        Race: {},
        Umamusume: {},
        UmamusumeScenario: scenarioData,
      });

      // raceTable.findMany: 1回目 = upsertRaces用, 2回目 = upsertScenarioRaces用
      mockPrisma.raceTable.findMany
        .mockResolvedValueOnce([]) // upsertRaces: 既存レースなし
        .mockResolvedValueOnce([
          // upsertScenarioRaces: レースマスタ
          { race_id: 10, race_name: '日本ダービー' },
          { race_id: 20, race_name: '菊花賞' },
          { race_id: 30, race_name: 'ジャパンカップ' },
        ]);

      // umamusumeTable.findMany: 1回目 = upsertUmamusume用, 2回目 = upsertScenarioRaces用
      mockPrisma.umamusumeTable.findMany
        .mockResolvedValueOnce([]) // upsertUmamusume: 既存ウマ娘なし
        .mockResolvedValueOnce([
          // upsertScenarioRaces: ウマ娘マスタ
          { umamusume_id: 1, umamusume_name: 'スペ' },
        ]);

      // scenarioRaceTable.findMany: 既存シナリオなし
      mockPrisma.scenarioRaceTable.findMany.mockResolvedValue([]);
    }

    it('形式A（文字列）: レース名からレコードを生成する', async () => {
      setupScenarioMocks({
        スペ: { '1': '日本ダービー' },
      });

      await service.onModuleInit();

      const insertedData =
        mockPrisma.scenarioRaceTable.createMany.mock.calls[0][0].data;
      expect(insertedData).toEqual([
        {
          umamusume_id: 1,
          race_id: 10,
          race_number: 1,
          random_group: null,
          senior_flag: null,
        },
      ]);
    });

    it('形式B（名前付き・シニア）: senior_flag が true になる', async () => {
      setupScenarioMocks({
        スペ: { '1': { 名前: 'ジャパンカップ', 時期: 'シニア' } },
      });

      await service.onModuleInit();

      const insertedData =
        mockPrisma.scenarioRaceTable.createMany.mock.calls[0][0].data;
      expect(insertedData[0].senior_flag).toBe(true);
      expect(insertedData[0].race_id).toBe(30);
    });

    it('形式B（名前付き・クラシック）: senior_flag が false になる', async () => {
      setupScenarioMocks({
        スペ: { '1': { 名前: '日本ダービー', 時期: 'クラシック' } },
      });

      await service.onModuleInit();

      const insertedData =
        mockPrisma.scenarioRaceTable.createMany.mock.calls[0][0].data;
      expect(insertedData[0].senior_flag).toBe(false);
    });

    it('形式B（名前付き・時期なし）: senior_flag が null になる', async () => {
      setupScenarioMocks({
        スペ: { '1': { 名前: '日本ダービー' } },
      });

      await service.onModuleInit();

      const insertedData =
        mockPrisma.scenarioRaceTable.createMany.mock.calls[0][0].data;
      expect(insertedData[0].senior_flag).toBeNull();
    });

    it('形式C/D（ネスト選択肢）: random_group が設定される', async () => {
      setupScenarioMocks({
        スペ: {
          '1': {
            '1': '日本ダービー',
            '2': '菊花賞',
          },
        },
      });

      await service.onModuleInit();

      const insertedData =
        mockPrisma.scenarioRaceTable.createMany.mock.calls[0][0].data;
      expect(insertedData).toHaveLength(2);
      expect(insertedData[0]).toEqual(
        expect.objectContaining({
          race_id: 10,
          race_number: 1,
          random_group: 1,
        }),
      );
      expect(insertedData[1]).toEqual(
        expect.objectContaining({
          race_id: 20,
          race_number: 1,
          random_group: 2,
        }),
      );
    });

    it('レース名がマスタに存在しない場合 → warn ログを出力してスキップする', async () => {
      mockLoadJsonFile({
        Race: {},
        Umamusume: {},
        UmamusumeScenario: { スペ: { '1': '存在しないレース' } },
      });
      mockPrisma.raceTable.findMany
        .mockResolvedValueOnce([]) // upsertRaces
        .mockResolvedValueOnce([
          // upsertScenarioRaces: レースマスタ（該当なし）
          { race_id: 10, race_name: '日本ダービー' },
        ]);
      mockPrisma.umamusumeTable.findMany
        .mockResolvedValueOnce([]) // upsertUmamusume
        .mockResolvedValueOnce([{ umamusume_id: 1, umamusume_name: 'スペ' }]);
      mockPrisma.scenarioRaceTable.findMany.mockResolvedValue([]);

      await service.onModuleInit();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { raceName: '存在しないレース', umamusumeId: 1 },
        'レース名がマスタに存在しないためスキップしました',
      );
      expect(mockPrisma.scenarioRaceTable.createMany).not.toHaveBeenCalled();
    });

    it('ウマ娘がマスタに存在しない場合 → warn ログを出力してスキップする', async () => {
      mockLoadJsonFile({
        Race: {},
        Umamusume: {},
        UmamusumeScenario: { 未知の馬: { '1': '日本ダービー' } },
      });
      mockPrisma.raceTable.findMany
        .mockResolvedValueOnce([]) // upsertRaces
        .mockResolvedValueOnce([{ race_id: 10, race_name: '日本ダービー' }]);
      mockPrisma.umamusumeTable.findMany
        .mockResolvedValueOnce([]) // upsertUmamusume
        .mockResolvedValueOnce([]); // upsertScenarioRaces: ウマ娘マスタに該当なし
      mockPrisma.scenarioRaceTable.findMany.mockResolvedValue([]);

      await service.onModuleInit();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { umamusumeName: '未知の馬' },
        'シナリオ JSON に記載のウマ娘がマスタに存在しないためスキップしました',
      );
    });

    it('既にシナリオ登録済みのウマ娘 → スキップする', async () => {
      mockLoadJsonFile({
        Race: {},
        Umamusume: {},
        UmamusumeScenario: { スペ: { '1': '日本ダービー' } },
      });
      mockPrisma.raceTable.findMany
        .mockResolvedValueOnce([]) // upsertRaces
        .mockResolvedValueOnce([{ race_id: 10, race_name: '日本ダービー' }]);
      mockPrisma.umamusumeTable.findMany
        .mockResolvedValueOnce([]) // upsertUmamusume
        .mockResolvedValueOnce([{ umamusume_id: 1, umamusume_name: 'スペ' }]);
      // 既にシナリオ登録済み
      mockPrisma.scenarioRaceTable.findMany.mockResolvedValue([
        { umamusume_id: 1 },
      ]);

      await service.onModuleInit();

      expect(mockPrisma.scenarioRaceTable.createMany).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // loadJsonFile エラーハンドリング
  // ─────────────────────────────────────────────
  describe('loadJsonFile エラーハンドリング', () => {
    it('ファイル読み込み失敗時に DatabaseException をスローする', async () => {
      jest
        .spyOn(service as never, 'loadJsonFile' as never)
        .mockRejectedValueOnce(
          new DatabaseException(
            'シードデータの読み込みに失敗しました: data/Race.json',
            'SeedService.upsertRaces',
            'DB_002',
          ),
        );

      await expect(service.onModuleInit()).rejects.toThrow(DatabaseException);
    });
  });

  // ─────────────────────────────────────────────
  // batchInsert エラーハンドリング
  // ─────────────────────────────────────────────
  describe('batchInsert エラーハンドリング', () => {
    it('DB 投入失敗時に DatabaseException をスローする', async () => {
      mockLoadJsonFile({
        Race: {
          新レース: {
            race_name: '新レース',
            race_state: 0,
            distance: 1,
            distance_detail: null,
            num_fans: 0,
            race_rank: 1,
            senior_flag: false,
            classic_flag: false,
            junior_flag: false,
            race_months: 1,
            half_flag: false,
            larc_flag: false,
            bc_flag: false,
          },
        },
        Umamusume: {},
        UmamusumeScenario: {},
      });
      mockPrisma.raceTable.findMany.mockResolvedValue([]);
      mockPrisma.raceTable.createMany.mockRejectedValue(
        new Error('DB接続エラー'),
      );

      await expect(service.onModuleInit()).rejects.toThrow(DatabaseException);
    });
  });
});
