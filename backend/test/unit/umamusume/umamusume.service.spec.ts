import { UmamusumeService } from '@src/umamusume/umamusume.service.js';
import { DatabaseException } from '@common/exceptions/database.exception.js';
import { ConflictException } from '@nestjs/common';
import type { UmamusumeTable } from '@prisma/client';

/**
 * 対象: src/umamusume/umamusume.service.ts
 */

/** テスト用ウマ娘データを生成する */
function makeUmamusume(
  overrides: Partial<UmamusumeTable> = {},
): UmamusumeTable {
  return {
    umamusume_id: 1,
    umamusume_name: 'テスト馬',
    turf_aptitude: 'A',
    dirt_aptitude: 'G',
    front_runner_aptitude: 'G',
    early_foot_aptitude: 'A',
    midfield_aptitude: 'A',
    closer_aptitude: 'C',
    sprint_aptitude: 'F',
    mile_aptitude: 'C',
    classic_aptitude: 'A',
    long_distance_aptitude: 'A',
    ...overrides,
  };
}

/** PrismaService のモック型 */
interface MockPrisma {
  umamusumeTable: {
    findMany: jest.Mock;
    findUniqueOrThrow: jest.Mock;
  };
  registUmamusumeTable: {
    findMany: jest.Mock;
    create: jest.Mock;
    deleteMany: jest.Mock;
  };
  registUmamusumeRaceTable: {
    createMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  $transaction: jest.Mock;
}

/** PinoLogger のモック型 */
interface MockLogger {
  info: jest.Mock;
  debug: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}

describe('UmamusumeService', () => {
  let service: UmamusumeService;
  let mockPrisma: MockPrisma;
  const mockLogger: MockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    mockPrisma = {
      umamusumeTable: {
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      registUmamusumeTable: {
        findMany: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      registUmamusumeRaceTable: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((input: unknown) => {
        if (typeof input === 'function') {
          return (input as (tx: MockPrisma) => Promise<unknown>)(mockPrisma);
        }
        return Promise.resolve(input);
      }),
    };
    service = new UmamusumeService(
      mockPrisma as unknown as ConstructorParameters<
        typeof UmamusumeService
      >[0],
      mockLogger as unknown as ConstructorParameters<
        typeof UmamusumeService
      >[1],
    );
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────
  describe('findAll', () => {
    it('全ウマ娘を UmamusumeResponse に変換して返す', async () => {
      const uma = makeUmamusume();
      mockPrisma.umamusumeTable.findMany.mockResolvedValue([uma]);

      const result = await service.findAll();

      expect(mockPrisma.umamusumeTable.findMany).toHaveBeenCalledWith({
        orderBy: { umamusume_id: 'asc' },
      });
      expect(result).toEqual([
        {
          umamusumeId: 1,
          umamusumeName: 'テスト馬',
          turfAptitude: 'A',
          dirtAptitude: 'G',
          frontRunnerAptitude: 'G',
          earlyFootAptitude: 'A',
          midfieldAptitude: 'A',
          closerAptitude: 'C',
          sprintAptitude: 'F',
          mileAptitude: 'C',
          classicAptitude: 'A',
          longDistanceAptitude: 'A',
        },
      ]);
    });

    it('Prisma エラー時に handlePrismaError 経由で例外をスローする', async () => {
      mockPrisma.umamusumeTable.findMany.mockRejectedValue(
        new Error('DB接続エラー'),
      );

      await expect(service.findAll()).rejects.toThrow(DatabaseException);
    });
  });

  // ─────────────────────────────────────────────
  // findUnregistered
  // ─────────────────────────────────────────────
  describe('findUnregistered', () => {
    const userId = 'user-001';

    it('登録済みウマ娘が存在しない場合 → notIn: [] でfindManyを呼ぶ', async () => {
      mockPrisma.registUmamusumeTable.findMany.mockResolvedValue([]);
      const uma = makeUmamusume();
      mockPrisma.umamusumeTable.findMany.mockResolvedValue([uma]);

      const result = await service.findUnregistered(userId);

      expect(mockPrisma.umamusumeTable.findMany).toHaveBeenCalledWith({
        where: { umamusume_id: { notIn: [] } },
        orderBy: { umamusume_id: 'asc' },
      });
      expect(result[0].umamusumeId).toBe(1);
    });

    it('登録済みウマ娘が存在する場合 → notInフィルタ付きでfindManyを呼ぶ', async () => {
      mockPrisma.registUmamusumeTable.findMany.mockResolvedValue([
        { umamusume_id: 1 },
        { umamusume_id: 3 },
      ]);
      const uma = makeUmamusume({ umamusume_id: 2, umamusume_name: 'スペ' });
      mockPrisma.umamusumeTable.findMany.mockResolvedValue([uma]);

      const result = await service.findUnregistered(userId);

      expect(mockPrisma.umamusumeTable.findMany).toHaveBeenCalledWith({
        where: { umamusume_id: { notIn: [1, 3] } },
        orderBy: { umamusume_id: 'asc' },
      });
      expect(result[0].umamusumeId).toBe(2);
    });

    it('Prisma エラー時に例外をスローする', async () => {
      mockPrisma.registUmamusumeTable.findMany.mockRejectedValue(
        new Error('DB接続エラー'),
      );

      await expect(service.findUnregistered(userId)).rejects.toThrow(
        DatabaseException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // findRegistered
  // ─────────────────────────────────────────────
  describe('findRegistered', () => {
    it('登録済みウマ娘を RegisteredUmamusumeResponse に変換して返す', async () => {
      const uma = makeUmamusume();
      mockPrisma.registUmamusumeTable.findMany.mockResolvedValue([
        { umamusume_id: 1, user_id: 'user-001', umamusume: uma },
      ]);

      const result = await service.findRegistered('user-001');

      expect(result).toEqual([
        {
          umamusume: {
            umamusumeId: 1,
            umamusumeName: 'テスト馬',
            turfAptitude: 'A',
            dirtAptitude: 'G',
            frontRunnerAptitude: 'G',
            earlyFootAptitude: 'A',
            midfieldAptitude: 'A',
            closerAptitude: 'C',
            sprintAptitude: 'F',
            mileAptitude: 'C',
            classicAptitude: 'A',
            longDistanceAptitude: 'A',
          },
        },
      ]);
    });

    it('登録済みウマ娘が存在しない場合 → 空配列を返す', async () => {
      mockPrisma.registUmamusumeTable.findMany.mockResolvedValue([]);

      const result = await service.findRegistered('user-001');

      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────
  // unregister
  // ─────────────────────────────────────────────
  describe('unregister', () => {
    const userId = 'user-001';
    const umamusumeId = 5;

    it('$transaction でレース削除とウマ娘削除を一括実行する', async () => {
      mockPrisma.registUmamusumeRaceTable.deleteMany.mockResolvedValue({
        count: 3,
      });
      mockPrisma.registUmamusumeTable.deleteMany.mockResolvedValue({
        count: 1,
      });

      await service.unregister(userId, umamusumeId);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('void を返す（レスポンスボディなし）', async () => {
      mockPrisma.registUmamusumeRaceTable.deleteMany.mockResolvedValue({
        count: 0,
      });
      mockPrisma.registUmamusumeTable.deleteMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.unregister(userId, umamusumeId);

      expect(result).toBeUndefined();
    });

    it('ログに userId と umamusumeId が含まれる', async () => {
      mockPrisma.registUmamusumeRaceTable.deleteMany.mockResolvedValue({
        count: 0,
      });
      mockPrisma.registUmamusumeTable.deleteMany.mockResolvedValue({
        count: 1,
      });

      await service.unregister(userId, umamusumeId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId, umamusumeId },
        'ウマ娘の登録を解除しました',
      );
    });

    it('Prisma エラー時に例外をスローする', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('DB接続エラー'));

      await expect(service.unregister(userId, umamusumeId)).rejects.toThrow(
        DatabaseException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // register
  // ─────────────────────────────────────────────
  describe('register', () => {
    const userId = 'user-001';
    const umamusumeId = 5;

    it('レースIDなしで登録する場合 → $transaction 内で create のみ呼ぶ', async () => {
      mockPrisma.registUmamusumeTable.create.mockResolvedValue({});
      const uma = makeUmamusume({
        umamusume_id: umamusumeId,
        umamusume_name: '登録馬',
      });
      mockPrisma.umamusumeTable.findUniqueOrThrow.mockResolvedValue(uma);

      const result = await service.register(userId, umamusumeId, []);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.registUmamusumeTable.create).toHaveBeenCalledWith({
        data: { user_id: userId, umamusume_id: umamusumeId },
      });
      expect(
        mockPrisma.registUmamusumeRaceTable.createMany,
      ).not.toHaveBeenCalled();
      expect(result.umamusumeId).toBe(umamusumeId);
    });

    it('レースIDありで登録する場合 → $transaction 内で create と createMany を呼ぶ', async () => {
      mockPrisma.registUmamusumeTable.create.mockResolvedValue({});
      mockPrisma.registUmamusumeRaceTable.createMany.mockResolvedValue({
        count: 2,
      });
      const uma = makeUmamusume({ umamusume_id: umamusumeId });
      mockPrisma.umamusumeTable.findUniqueOrThrow.mockResolvedValue(uma);

      const raceIdArray = [10, 20];
      const result = await service.register(userId, umamusumeId, raceIdArray);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(
        mockPrisma.registUmamusumeRaceTable.createMany,
      ).toHaveBeenCalledWith({
        data: [
          { user_id: userId, umamusume_id: umamusumeId, race_id: 10 },
          { user_id: userId, umamusume_id: umamusumeId, race_id: 20 },
        ],
      });
      expect(result.umamusumeId).toBe(umamusumeId);
    });

    it('UmamusumeResponse 形式で結果を返す', async () => {
      mockPrisma.registUmamusumeTable.create.mockResolvedValue({});
      const uma = makeUmamusume({
        umamusume_id: umamusumeId,
        umamusume_name: '登録馬',
      });
      mockPrisma.umamusumeTable.findUniqueOrThrow.mockResolvedValue(uma);

      const result = await service.register(userId, umamusumeId, []);

      expect(result).toEqual({
        umamusumeId: umamusumeId,
        umamusumeName: '登録馬',
        turfAptitude: 'A',
        dirtAptitude: 'G',
        frontRunnerAptitude: 'G',
        earlyFootAptitude: 'A',
        midfieldAptitude: 'A',
        closerAptitude: 'C',
        sprintAptitude: 'F',
        mileAptitude: 'C',
        classicAptitude: 'A',
        longDistanceAptitude: 'A',
      });
    });

    it('重複登録時に ConflictException をスローする', async () => {
      const { Prisma } = await import('@prisma/client');
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint',
        {
          code: 'P2002',
          clientVersion: '6.0.0',
        },
      );
      mockPrisma.$transaction.mockRejectedValue(prismaError);

      await expect(service.register(userId, umamusumeId, [])).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
