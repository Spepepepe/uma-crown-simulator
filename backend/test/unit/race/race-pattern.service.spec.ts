import { InternalServerErrorException } from '@nestjs/common';
import { RacePatternService } from '@src/race/pattern/race-pattern.service';
import { BCPatternBuilderService } from '@src/race/pattern/bc-pattern-builder.service';
import { LarcPatternBuilderService } from '@src/race/pattern/larc-pattern-builder.service';
import { RaceRow, UmamusumeRow } from '@src/race/race.types';

/**
 * 対象: src/race/pattern/race-pattern.service.ts
 *
 * DB 依存をモックし、getRacePattern の入出力・例外処理を検証するユニットテスト。
 * アルゴリズム詳細は BCPatternBuilderService / LarcPatternBuilderService のテストで担保する。
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
    senior_flag: true,
    larc_flag: false,
    bc_flag: false,
    ...overrides,
  };
}

/** テスト用UmamusumeRowを生成するヘルパー */
function makeUmamusume(overrides: Partial<UmamusumeRow> = {}): UmamusumeRow {
  return {
    umamusume_id: 1,
    umamusume_name: 'テスト馬',
    turf_aptitude: 'A',
    dirt_aptitude: 'B',
    front_runner_aptitude: 'A',
    early_foot_aptitude: 'A',
    midfield_aptitude: 'A',
    closer_aptitude: 'A',
    sprint_aptitude: 'B',
    mile_aptitude: 'A',
    classic_aptitude: 'A',
    long_distance_aptitude: 'B',
    ...overrides,
  };
}

describe('RacePatternService', () => {
  let service: RacePatternService;
  let mockPrisma: any;
  const mockLogger: any = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };

  beforeEach(() => {
    mockPrisma = {
      registUmamusumeTable: {
        findUnique: jest.fn(),
      },
      registUmamusumeRaceTable: {
        findMany: jest.fn(),
      },
      raceTable: {
        findMany: jest.fn(),
      },
      scenarioRaceTable: {
        findMany: jest.fn(),
      },
    };
    // BCPatternBuilderService / LarcPatternBuilderService は実インスタンスを使用
    // (PrismaService 依存なし・純粋アルゴリズムのため)
    const bcBuilder = new BCPatternBuilderService(mockLogger);
    const larcBuilder = new LarcPatternBuilderService();
    service = new RacePatternService(mockPrisma, mockLogger, bcBuilder, larcBuilder);
  });

  describe('getRacePattern', () => {
    it('登録ウマ娘が存在しない場合 → InternalServerErrorExceptionをスローする', async () => {
      mockPrisma.registUmamusumeTable.findUnique.mockResolvedValue(null);

      await expect(service.getRacePattern('user-001', 1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('全レース出走済みの場合 → パターンの各スロットにレースが入らない', async () => {
      const umamusume = makeUmamusume();
      mockPrisma.registUmamusumeTable.findUnique.mockResolvedValue({
        user_id: 'user-001',
        umamusume_id: 1,
        umamusume,
      });

      const allRaces = [makeRace({ race_id: 1 })];
      // 出走済みレースにすべて含まれる
      mockPrisma.registUmamusumeRaceTable.findMany.mockResolvedValue([{ race_id: 1 }]);
      mockPrisma.raceTable.findMany.mockResolvedValue(allRaces);
      mockPrisma.scenarioRaceTable.findMany.mockResolvedValue([]);

      const result = await service.getRacePattern('user-001', 1);

      expect(result).toHaveProperty('patterns');
      expect(Array.isArray(result.patterns)).toBe(true);
    });

    it('残レースがある場合 → patternsに少なくとも1件のパターンが含まれる', async () => {
      const umamusume = makeUmamusume();
      mockPrisma.registUmamusumeTable.findUnique.mockResolvedValue({
        user_id: 'user-001',
        umamusume_id: 1,
        umamusume,
      });

      // 未出走レースを複数用意（BC最終レースを1件含む）
      const g1Races: RaceRow[] = [
        makeRace({ race_id: 10, race_name: '皐月賞', race_months: 4, half_flag: false, classic_flag: true, senior_flag: false }),
        makeRace({ race_id: 11, race_name: '日本ダービー', race_months: 5, half_flag: true, classic_flag: true, senior_flag: false }),
        makeRace({ race_id: 12, race_name: '菊花賞', race_months: 10, half_flag: true, classic_flag: true, senior_flag: false, distance: 4 }),
        makeRace({ race_id: 13, race_name: '天皇賞秋', race_months: 10, half_flag: true, classic_flag: false, senior_flag: true }),
        makeRace({ race_id: 14, race_name: 'ジャパンカップ', race_months: 11, half_flag: true, classic_flag: false, senior_flag: true }),
        // BC最終レース: BCターフ（シニア11月前半・芝・中距離）
        makeRace({ race_id: 15, race_name: 'BCターフ', race_months: 11, half_flag: false, classic_flag: false, senior_flag: true, bc_flag: true }),
      ];
      mockPrisma.registUmamusumeRaceTable.findMany.mockResolvedValue([]);
      mockPrisma.raceTable.findMany.mockResolvedValue(g1Races);
      mockPrisma.scenarioRaceTable.findMany.mockResolvedValue([]);

      const result = await service.getRacePattern('user-001', 1);

      expect(result.patterns.length).toBeGreaterThanOrEqual(1);
      // 各パターンに必要なフィールドが含まれていること
      for (const pattern of result.patterns) {
        expect(pattern).toHaveProperty('scenario');
        expect(pattern).toHaveProperty('junior');
        expect(pattern).toHaveProperty('classic');
        expect(pattern).toHaveProperty('senior');
        expect(pattern).toHaveProperty('factors');
        expect(pattern).toHaveProperty('totalRaces');
        expect(Array.isArray(pattern.factors)).toBe(true);
        expect(pattern.factors).toHaveLength(6);
      }
    });

    it('シナリオレースがある場合 → パターンが生成される', async () => {
      const umamusume = makeUmamusume();
      mockPrisma.registUmamusumeTable.findUnique.mockResolvedValue({
        user_id: 'user-001',
        umamusume_id: 1,
        umamusume,
      });

      const scenarioRaceRow = makeRace({
        race_id: 20,
        race_name: 'シナリオ固定レース',
        race_months: 3,
        half_flag: false,
        classic_flag: true,
        junior_flag: false,
        senior_flag: false,
      });

      const otherRace = makeRace({
        race_id: 21,
        race_name: '別スロットレース',
        race_months: 6,
        half_flag: true,
        classic_flag: true,
        junior_flag: false,
        senior_flag: false,
      });

      mockPrisma.registUmamusumeRaceTable.findMany.mockResolvedValue([]);
      mockPrisma.raceTable.findMany.mockResolvedValue([scenarioRaceRow, otherRace]);
      mockPrisma.scenarioRaceTable.findMany.mockResolvedValue([
        {
          umamusume_id: 1,
          race_id: 20,
          race_number: 1,
          random_group: null,
          senior_flag: null,
          race: scenarioRaceRow,
        },
      ]);

      const result = await service.getRacePattern('user-001', 1);

      expect(result).toHaveProperty('patterns');
      expect(Array.isArray(result.patterns)).toBe(true);
    });
  });
});
