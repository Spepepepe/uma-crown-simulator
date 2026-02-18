import { BreedingCountService } from '../../../src/race/breeding-count.service';
import type { RaceRow } from '@uma-crown/shared';

/**
 * 対象: src/race/breeding-count.service.ts
 */

/** テスト用RaceRowを生成するヘルパー */
function makeRace(overrides: Partial<RaceRow> = {}): RaceRow {
  return {
    race_id: 1,
    race_name: 'テストレース',
    race_state: 0,
    distance: 3,
    distance_detail: null,
    num_fans: 10000,
    race_months: 6,
    half_flag: false,
    race_rank: 1,
    junior_flag: false,
    classic_flag: true,
    senior_flag: false,
    scenario_flag: false,
    ...overrides,
  };
}

describe('BreedingCountService', () => {
  let service: BreedingCountService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      scenarioRaceTable: {
        findMany: jest.fn(),
      },
    };
    service = new BreedingCountService(mockPrisma);
  });

  // ─────────────────────────────────────────────
  // calculate (同期)
  // ─────────────────────────────────────────────
  describe('calculate', () => {
    it('残レースが空の場合 → 育成回数1を返す', () => {
      expect(service.calculate([])).toBe(1);
    });

    it('同一スロットに単一グレードレース1件 → 育成回数1を返す', () => {
      const races = [
        makeRace({ race_id: 1, classic_flag: true, junior_flag: false, senior_flag: false }),
      ];
      expect(service.calculate(races)).toBe(1);
    });

    it('同一スロット(クラシック・6月前半)に2件 → 育成回数2を返す', () => {
      const races = [
        makeRace({ race_id: 1, classic_flag: true, junior_flag: false, senior_flag: false, race_months: 6, half_flag: false }),
        makeRace({ race_id: 2, classic_flag: true, junior_flag: false, senior_flag: false, race_months: 6, half_flag: false }),
      ];
      expect(service.calculate(races)).toBe(2);
    });

    it('異なるスロットにレースがある場合 → 最大スロット数を返す', () => {
      const races = [
        makeRace({ race_id: 1, classic_flag: true, junior_flag: false, senior_flag: false, race_months: 4, half_flag: false }),
        makeRace({ race_id: 2, classic_flag: true, junior_flag: false, senior_flag: false, race_months: 4, half_flag: false }),
        makeRace({ race_id: 3, classic_flag: true, junior_flag: false, senior_flag: false, race_months: 4, half_flag: false }),
        makeRace({ race_id: 4, classic_flag: true, junior_flag: false, senior_flag: false, race_months: 6, half_flag: true }),
      ];
      // 4月前半スロットに3件 → maxCount=3
      expect(service.calculate(races)).toBe(3);
    });

    it('クラシック・シニア両方に属するレース → 各グレードで0.5として計算', () => {
      const races = [
        makeRace({ race_id: 1, junior_flag: false, classic_flag: true, senior_flag: true, race_months: 12, half_flag: false }),
        makeRace({ race_id: 2, junior_flag: false, classic_flag: true, senior_flag: true, race_months: 12, half_flag: false }),
      ];
      // 各ターンで 0.5 × 2 = 1.0 → Math.ceil(1.0) = 1
      expect(service.calculate(races)).toBe(1);
    });

    it('3グレードすべてに属するレース3件 → 切り上げで2を返す', () => {
      const races = [
        makeRace({ race_id: 1, junior_flag: true, classic_flag: true, senior_flag: true, race_months: 1, half_flag: false }),
        makeRace({ race_id: 2, junior_flag: true, classic_flag: true, senior_flag: true, race_months: 1, half_flag: false }),
        makeRace({ race_id: 3, junior_flag: true, classic_flag: true, senior_flag: true, race_months: 1, half_flag: false }),
      ];
      // 各ターンで 0.5 × 3 = 1.5 → Math.ceil(1.5) = 2
      expect(service.calculate(races)).toBe(2);
    });
  });

  // ─────────────────────────────────────────────
  // calculateAsync (非同期・Prismaモック使用)
  // ─────────────────────────────────────────────
  describe('calculateAsync', () => {
    it('シナリオレースが存在しない場合 → calculateと同じ結果を返す', async () => {
      mockPrisma.scenarioRaceTable.findMany.mockResolvedValue([]);

      const races = [
        makeRace({ race_id: 1, classic_flag: true, junior_flag: false, senior_flag: false, race_months: 5, half_flag: true }),
        makeRace({ race_id: 2, classic_flag: true, junior_flag: false, senior_flag: false, race_months: 5, half_flag: true }),
      ];

      const result = await service.calculateAsync(1, races);
      expect(result).toBe(service.calculate(races));
    });

    it('シナリオレースと競合する残レースがある場合 → 競合数も考慮した育成回数を返す', async () => {
      const scenarioRace = makeRace({
        race_id: 99,
        race_name: 'シナリオレース',
        race_months: 6,
        half_flag: false,
        classic_flag: true,
        junior_flag: false,
        senior_flag: false,
      });
      mockPrisma.scenarioRaceTable.findMany.mockResolvedValue([
        { umamusume_id: 1, race_id: 99, race: scenarioRace },
      ]);

      // 6月前半に残レースが3件（シナリオと競合）
      const races = [
        makeRace({ race_id: 1, classic_flag: true, junior_flag: false, senior_flag: false, race_months: 6, half_flag: false }),
        makeRace({ race_id: 2, classic_flag: true, junior_flag: false, senior_flag: false, race_months: 6, half_flag: false }),
        makeRace({ race_id: 3, classic_flag: true, junior_flag: false, senior_flag: false, race_months: 6, half_flag: false }),
      ];

      const result = await service.calculateAsync(1, races);
      // remainingCount=3, conflictCount=3 → max=3
      expect(result).toBe(3);
    });

    it('競合レースがない場合 → 通常の残レース数に基づく育成回数を返す', async () => {
      const scenarioRace = makeRace({
        race_id: 99,
        race_name: 'シナリオレース',
        race_months: 11,
        half_flag: false,
      });
      mockPrisma.scenarioRaceTable.findMany.mockResolvedValue([
        { umamusume_id: 1, race_id: 99, race: scenarioRace },
      ]);

      // 11月前半以外のスロットにレース → 競合なし
      const races = [
        makeRace({ race_id: 1, classic_flag: true, junior_flag: false, senior_flag: false, race_months: 6, half_flag: false }),
      ];

      const result = await service.calculateAsync(1, races);
      expect(result).toBe(1);
    });
  });
});
