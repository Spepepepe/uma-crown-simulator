import { UmamusumeService } from '@src/umamusume/umamusume.service';

/**
 * 対象: src/umamusume/umamusume.service.ts
 */

describe('UmamusumeService', () => {
  let service: UmamusumeService;
  let mockPrisma: any;
  const mockLogger: any = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    mockPrisma = {
      umamusumeTable: {
        findMany: jest.fn(),
      },
      registUmamusumeTable: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      registUmamusumeRaceTable: {
        createMany: jest.fn(),
      },
    };
    service = new UmamusumeService(mockPrisma, mockLogger);
  });

  // ─────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────
  describe('findAll', () => {
    it('全ウマ娘をumamusume_id昇順で取得する', async () => {
      const mockList = [
        { umamusume_id: 1, umamusume_name: 'ゴルシ' },
        { umamusume_id: 2, umamusume_name: 'スペ' },
      ];
      mockPrisma.umamusumeTable.findMany.mockResolvedValue(mockList);

      const result = await service.findAll();

      expect(mockPrisma.umamusumeTable.findMany).toHaveBeenCalledWith({
        orderBy: { umamusume_id: 'asc' },
      });
      expect(result).toEqual(mockList);
    });
  });

  // ─────────────────────────────────────────────
  // findUnregistered
  // ─────────────────────────────────────────────
  describe('findUnregistered', () => {
    const userId = 'user-001';

    it('登録済みウマ娘が存在しない場合 → whereなしでfindManyを呼ぶ', async () => {
      mockPrisma.registUmamusumeTable.findMany.mockResolvedValue([]);
      const unregistered = [{ umamusume_id: 1 }, { umamusume_id: 2 }];
      mockPrisma.umamusumeTable.findMany.mockResolvedValue(unregistered);

      const result = await service.findUnregistered(userId);

      expect(mockPrisma.umamusumeTable.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { umamusume_id: 'asc' },
      });
      expect(result).toEqual(unregistered);
    });

    it('登録済みウマ娘が存在する場合 → notInフィルタ付きでfindManyを呼ぶ', async () => {
      mockPrisma.registUmamusumeTable.findMany.mockResolvedValue([
        { umamusume_id: 1 },
        { umamusume_id: 3 },
      ]);
      const unregistered = [{ umamusume_id: 2 }];
      mockPrisma.umamusumeTable.findMany.mockResolvedValue(unregistered);

      const result = await service.findUnregistered(userId);

      expect(mockPrisma.umamusumeTable.findMany).toHaveBeenCalledWith({
        where: { umamusume_id: { notIn: [1, 3] } },
        orderBy: { umamusume_id: 'asc' },
      });
      expect(result).toEqual(unregistered);
    });
  });

  // ─────────────────────────────────────────────
  // findRegistered
  // ─────────────────────────────────────────────
  describe('findRegistered', () => {
    it('登録済みウマ娘を{ umamusume }形式にマッピングして返す', async () => {
      const uma = { umamusume_id: 1, umamusume_name: 'テスト馬' };
      mockPrisma.registUmamusumeTable.findMany.mockResolvedValue([
        { umamusume_id: 1, user_id: 'user-001', umamusume: uma },
      ]);

      const result = await service.findRegistered('user-001');

      expect(result).toEqual([{ umamusume: uma }]);
    });

    it('登録済みウマ娘が存在しない場合 → 空配列を返す', async () => {
      mockPrisma.registUmamusumeTable.findMany.mockResolvedValue([]);

      const result = await service.findRegistered('user-001');

      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────
  // register
  // ─────────────────────────────────────────────
  describe('register', () => {
    const userId = 'user-001';
    const umamusumeId = 5;

    it('レースIDなしで登録する場合 → registUmamusumeTableにのみcreateを呼ぶ', async () => {
      mockPrisma.registUmamusumeTable.create.mockResolvedValue({});

      const result = await service.register(userId, umamusumeId, []);

      expect(mockPrisma.registUmamusumeTable.create).toHaveBeenCalledWith({
        data: { user_id: userId, umamusume_id: umamusumeId },
      });
      expect(mockPrisma.registUmamusumeRaceTable.createMany).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'ウマ娘を登録しました' });
    });

    it('レースIDありで登録する場合 → registUmamusumeRaceTableにもcreateManyを呼ぶ', async () => {
      mockPrisma.registUmamusumeTable.create.mockResolvedValue({});
      mockPrisma.registUmamusumeRaceTable.createMany.mockResolvedValue({ count: 2 });

      const raceIdArray = [10, 20];
      const result = await service.register(userId, umamusumeId, raceIdArray);

      expect(mockPrisma.registUmamusumeTable.create).toHaveBeenCalled();
      expect(mockPrisma.registUmamusumeRaceTable.createMany).toHaveBeenCalledWith({
        data: [
          { user_id: userId, umamusume_id: umamusumeId, race_id: 10 },
          { user_id: userId, umamusume_id: umamusumeId, race_id: 20 },
        ],
      });
      expect(result).toEqual({ message: 'ウマ娘を登録しました' });
    });
  });
});
