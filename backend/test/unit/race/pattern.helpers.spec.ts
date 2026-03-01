import {
  getApt,
  sk,
  skFromIdx,
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
} from '@src/race/pattern/pattern.helpers';
import type { RaceRow, UmamusumeRow, PatternData } from '@src/race/race.types';

/**
 * 対象: src/race/pattern/pattern.helpers.ts
 * 全エクスポート純粋関数の単体テスト
 */

// ============================================================
// テスト用ヘルパー
// ============================================================

function makeRace(overrides: Partial<RaceRow> = {}): RaceRow {
  return {
    race_id: 1,
    race_name: 'テストレース',
    race_state: 0,
    distance: 3,
    distance_detail: null,
    num_fans: 10000,
    race_months: 5,
    half_flag: false,
    race_rank: 1,
    junior_flag: false,
    classic_flag: true,
    senior_flag: false,
    larc_flag: false,
    bc_flag: false,
    ...overrides,
  } as RaceRow;
}

function makeUma(overrides: Partial<UmamusumeRow> = {}): UmamusumeRow {
  return {
    umamusume_id: 1,
    umamusume_name: 'テスト馬',
    turf_aptitude: 'A',
    dirt_aptitude: 'A',
    front_runner_aptitude: 'A',
    early_foot_aptitude: 'A',
    midfield_aptitude: 'A',
    closer_aptitude: 'A',
    sprint_aptitude: 'A',
    mile_aptitude: 'A',
    classic_aptitude: 'A',
    long_distance_aptitude: 'A',
    ...overrides,
  } as UmamusumeRow;
}

// ============================================================
// getApt
// ============================================================

describe('getApt', () => {
  it.each([
    ['S', 4], ['A', 3], ['B', 2], ['C', 1], ['D', 0],
    ['E', -1], ['F', -2], ['G', -3],
  ] as [string, number][])('%s → %i', (char, expected) => {
    expect(getApt(char)).toBe(expected);
  });

  it('未知の文字列 → 0', () => {
    expect(getApt('X')).toBe(0);
    expect(getApt('')).toBe(0);
  });
});

// ============================================================
// sk
// ============================================================

describe('sk', () => {
  it('"grade|month|half" 形式のキーを返す', () => {
    expect(sk('classic', 5, true)).toBe('classic|5|true');
    expect(sk('junior', 11, false)).toBe('junior|11|false');
    expect(sk('senior', 1, false)).toBe('senior|1|false');
  });
});

// ============================================================
// skFromIdx
// ============================================================

describe('skFromIdx', () => {
  it('index 0 → junior 7月前半', () => {
    expect(skFromIdx(0)).toBe('junior|7|false');
  });
  it('index 1 → junior 7月後半', () => {
    expect(skFromIdx(1)).toBe('junior|7|true');
  });
  it('index 12 → classic 1月前半', () => {
    expect(skFromIdx(12)).toBe('classic|1|false');
  });
  it('index 36 → senior 1月前半', () => {
    expect(skFromIdx(36)).toBe('senior|1|false');
  });
});

// ============================================================
// getAvailableSlots
// ============================================================

describe('getAvailableSlots', () => {
  it('classic_flag=true のみ → classicスロット1件', () => {
    const race = makeRace({ classic_flag: true, junior_flag: false, senior_flag: false, race_months: 5, half_flag: true });
    const slots = getAvailableSlots(race);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toEqual({ grade: 'classic', month: 5, half: true });
  });

  it('classic_flag + senior_flag → 2スロット（classicとseniorの両方）', () => {
    const race = makeRace({ classic_flag: true, senior_flag: true, junior_flag: false, race_months: 6, half_flag: false });
    const slots = getAvailableSlots(race);
    expect(slots).toHaveLength(2);
    expect(slots.some((s) => s.grade === 'classic')).toBe(true);
    expect(slots.some((s) => s.grade === 'senior')).toBe(true);
  });

  it('junior_flag=true のみ → juniorスロット1件', () => {
    const race = makeRace({ junior_flag: true, classic_flag: false, senior_flag: false, race_months: 10, half_flag: false });
    const slots = getAvailableSlots(race);
    expect(slots).toHaveLength(1);
    expect(slots[0].grade).toBe('junior');
  });

  it('全フラグ false → スロット0件', () => {
    const race = makeRace({ junior_flag: false, classic_flag: false, senior_flag: false });
    expect(getAvailableSlots(race)).toHaveLength(0);
  });
});

// ============================================================
// isLarcRestrictedSlot
// ============================================================

describe('isLarcRestrictedSlot', () => {
  describe('classic', () => {
    it('5月後半 → true（日本ダービー強制配置スロット）', () => {
      expect(isLarcRestrictedSlot('classic', 5, true)).toBe(true);
    });
    it('5月前半 → false', () => {
      expect(isLarcRestrictedSlot('classic', 5, false)).toBe(false);
    });
    it.each([7, 8, 9])('%i月（前後半とも） → true', (month) => {
      expect(isLarcRestrictedSlot('classic', month, false)).toBe(true);
      expect(isLarcRestrictedSlot('classic', month, true)).toBe(true);
    });
    it('10月前半 → true', () => {
      expect(isLarcRestrictedSlot('classic', 10, false)).toBe(true);
    });
    it('10月後半 → false', () => {
      expect(isLarcRestrictedSlot('classic', 10, true)).toBe(false);
    });
    it('6月後半 → false', () => {
      expect(isLarcRestrictedSlot('classic', 6, true)).toBe(false);
    });
  });

  describe('senior', () => {
    it('6月後半 → true', () => {
      expect(isLarcRestrictedSlot('senior', 6, true)).toBe(true);
    });
    it('6月前半 → false', () => {
      expect(isLarcRestrictedSlot('senior', 6, false)).toBe(false);
    });
    it.each([7, 8, 9, 10, 11, 12])('senior %i月前半 → true', (month) => {
      expect(isLarcRestrictedSlot('senior', month, false)).toBe(true);
    });
    it('senior 5月後半 → false', () => {
      expect(isLarcRestrictedSlot('senior', 5, true)).toBe(false);
    });
  });

  describe('junior', () => {
    it('任意のスロット → false', () => {
      expect(isLarcRestrictedSlot('junior', 10, false)).toBe(false);
      expect(isLarcRestrictedSlot('junior', 12, true)).toBe(false);
    });
  });
});

// ============================================================
// isBCRestrictedSlot
// ============================================================

describe('isBCRestrictedSlot', () => {
  it('senior 11月後半 → true', () => {
    expect(isBCRestrictedSlot('senior', 11, true)).toBe(true);
  });
  it('senior 12月前半 → true', () => {
    expect(isBCRestrictedSlot('senior', 12, false)).toBe(true);
  });
  it('senior 12月後半 → true', () => {
    expect(isBCRestrictedSlot('senior', 12, true)).toBe(true);
  });
  it('senior 11月前半 → true（BC最終レース配置スロットも割り当て不可）', () => {
    expect(isBCRestrictedSlot('senior', 11, false)).toBe(true);
  });
  it('senior 10月後半 → false', () => {
    expect(isBCRestrictedSlot('senior', 10, true)).toBe(false);
  });
  it('classic 11月後半 → false', () => {
    expect(isBCRestrictedSlot('classic', 11, true)).toBe(false);
  });
  it('junior 12月後半 → false', () => {
    expect(isBCRestrictedSlot('junior', 12, true)).toBe(false);
  });
});

// ============================================================
// getConsecutiveLength / isConsecutiveViolation
// ============================================================

describe('getConsecutiveLength', () => {
  it('空グリッドで提案スロット → 1', () => {
    const grid = new Map<string, RaceRow>();
    expect(getConsecutiveLength(grid, 'classic|4|false')).toBe(1);
  });

  it('前後に1件ずつ既存 + 提案 → 3連続', () => {
    // classic 4月前(idx=18), 4月後(idx=19) が既存、5月前(idx=20) を提案
    const grid = new Map<string, RaceRow>([
      ['classic|4|false', makeRace()],
      ['classic|4|true',  makeRace()],
    ]);
    expect(getConsecutiveLength(grid, 'classic|5|false')).toBe(3);
  });

  it('3件連続既存の先頭に提案 → 4連続', () => {
    // classic 4月後(19), 5月前(20), 5月後(21) が既存、4月前(18) を提案
    const grid = new Map<string, RaceRow>([
      ['classic|4|true',  makeRace()],
      ['classic|5|false', makeRace()],
      ['classic|5|true',  makeRace()],
    ]);
    expect(getConsecutiveLength(grid, 'classic|4|false')).toBe(4);
  });

  it('隣接なし → 1', () => {
    const grid = new Map<string, RaceRow>([
      ['classic|1|false', makeRace()],
    ]);
    expect(getConsecutiveLength(grid, 'classic|4|false')).toBe(1);
  });
});

describe('isConsecutiveViolation', () => {
  it('3連続以内になる → false', () => {
    const grid = new Map<string, RaceRow>([
      ['classic|4|false', makeRace()],
      ['classic|4|true',  makeRace()],
    ]);
    // 提案でちょうど3連続 → 違反なし
    expect(isConsecutiveViolation(grid, 'classic|5|false')).toBe(false);
  });

  it('4連続になる → true', () => {
    const grid = new Map<string, RaceRow>([
      ['classic|4|true',  makeRace()],
      ['classic|5|false', makeRace()],
      ['classic|5|true',  makeRace()],
    ]);
    expect(isConsecutiveViolation(grid, 'classic|4|false')).toBe(true);
  });
});

// ============================================================
// buildPatternFromGrid
// ============================================================

describe('buildPatternFromGrid', () => {
  it('空グリッド → 全スロット race_id: null', () => {
    const pattern = buildPatternFromGrid(new Map());
    expect(pattern.junior.every((s) => s.race_id === null)).toBe(true);
    expect(pattern.classic.every((s) => s.race_id === null)).toBe(true);
    expect(pattern.senior.every((s) => s.race_id === null)).toBe(true);
  });

  it('1件配置 → 対象スロットにレース情報が入る', () => {
    const race = makeRace({ race_id: 42, race_name: '日本ダービー', race_months: 5, half_flag: true });
    const grid = new Map([['classic|5|true', race]]);
    const pattern = buildPatternFromGrid(grid);
    const slot = pattern.classic.find((s) => s.month === 5 && s.half === true);
    expect(slot?.race_id).toBe(42);
    expect(slot?.race_name).toBe('日本ダービー');
  });

  it('スロット数: junior=12, classic=24, senior=24', () => {
    const pattern = buildPatternFromGrid(new Map());
    // junior: 7〜12月 × 前後半 = 12
    expect(pattern.junior).toHaveLength(12);
    // classic/senior: 1〜12月 × 前後半 = 24
    expect(pattern.classic).toHaveLength(24);
    expect(pattern.senior).toHaveLength(24);
  });

  it('配置したスロット以外は空（race_id: null）', () => {
    const race = makeRace({ race_id: 10 });
    const grid = new Map([['classic|5|true', race]]);
    const pattern = buildPatternFromGrid(grid);
    const otherSlots = pattern.classic.filter((s) => !(s.month === 5 && s.half === true));
    expect(otherSlots.every((s) => s.race_id === null)).toBe(true);
  });
});

// ============================================================
// getAllRacesInPattern
// ============================================================

describe('getAllRacesInPattern', () => {
  it('パターン内の race_id に対応するレースを返す', () => {
    const race1 = makeRace({ race_id: 10 });
    const race2 = makeRace({ race_id: 20 });
    const grid = new Map<string, RaceRow>([
      ['classic|5|true', race1],
      ['senior|6|true',  race2],
    ]);
    const pattern = buildPatternFromGrid(grid);
    const result = getAllRacesInPattern(pattern, [race1, race2, makeRace({ race_id: 99 })]);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.race_id)).toContain(10);
    expect(result.map((r) => r.race_id)).toContain(20);
  });

  it('空パターン → 空配列', () => {
    const pattern = buildPatternFromGrid(new Map());
    expect(getAllRacesInPattern(pattern, [makeRace()])).toHaveLength(0);
  });

  it('allGRaces に存在しない race_id は無視される', () => {
    const race = makeRace({ race_id: 10 });
    const grid = new Map([['classic|5|true', race]]);
    const pattern = buildPatternFromGrid(grid);
    // allGRaces には race_id=10 が存在しない
    expect(getAllRacesInPattern(pattern, [makeRace({ race_id: 99 })])).toHaveLength(0);
  });
});

// ============================================================
// calculateAndSetMainConditions
// ============================================================

describe('calculateAndSetMainConditions', () => {
  it('芝中距離レースのみ → surface="芝", distance="中距離"', () => {
    const races = [
      makeRace({ race_state: 0, distance: 3 }),
      makeRace({ race_state: 0, distance: 3 }),
    ];
    const pattern: PatternData = { junior: [], classic: [], senior: [] };
    calculateAndSetMainConditions(pattern, races);
    expect(pattern.surface).toBe('芝');
    expect(pattern.distance).toBe('中距離');
  });

  it('芝2件・ダート1件 → surface="芝"（多数決）', () => {
    const races = [
      makeRace({ race_state: 0 }),
      makeRace({ race_state: 0 }),
      makeRace({ race_state: 1 }),
    ];
    const pattern: PatternData = { junior: [], classic: [], senior: [] };
    calculateAndSetMainConditions(pattern, races);
    expect(pattern.surface).toBe('芝');
  });

  it('中距離2件・マイル1件 → distance="中距離"', () => {
    const races = [
      makeRace({ distance: 3 }),
      makeRace({ distance: 3 }),
      makeRace({ distance: 2 }),
    ];
    const pattern: PatternData = { junior: [], classic: [], senior: [] };
    calculateAndSetMainConditions(pattern, races);
    expect(pattern.distance).toBe('中距離');
  });

  it('ダートのみ → surface="ダート"', () => {
    const races = [makeRace({ race_state: 1 })];
    const pattern: PatternData = { junior: [], classic: [], senior: [] };
    calculateAndSetMainConditions(pattern, races);
    expect(pattern.surface).toBe('ダート');
  });
});

// ============================================================
// calcBCStrategy
// ============================================================

describe('calcBCStrategy', () => {
  it('芝C以上かつ中距離C以上 → null（Bパターン・補修不要）', () => {
    const bcRace = makeRace({ race_state: 0, distance: 3 });
    expect(calcBCStrategy(bcRace, makeUma({ turf_aptitude: 'A', classic_aptitude: 'A' }))).toBeNull();
  });

  it('C境界値（芝C・距離C）→ null', () => {
    const bcRace = makeRace({ race_state: 0, distance: 3 });
    expect(calcBCStrategy(bcRace, makeUma({ turf_aptitude: 'C', classic_aptitude: 'C' }))).toBeNull();
  });

  it('芝G → {芝: 3}（G→C に3枚必要、上限クリップ）', () => {
    const bcRace = makeRace({ race_state: 0, distance: 3 });
    expect(calcBCStrategy(bcRace, makeUma({ turf_aptitude: 'G', classic_aptitude: 'A' }))).toEqual({ '芝': 3 });
  });

  it('距離D → {中距離: 1}（D→C に1枚必要）', () => {
    const bcRace = makeRace({ race_state: 0, distance: 3 });
    expect(calcBCStrategy(bcRace, makeUma({ turf_aptitude: 'A', classic_aptitude: 'D' }))).toEqual({ '中距離': 1 });
  });

  it('芝D・距離D → {芝: 1, 中距離: 1}', () => {
    const bcRace = makeRace({ race_state: 0, distance: 3 });
    expect(calcBCStrategy(bcRace, makeUma({ turf_aptitude: 'D', classic_aptitude: 'D' }))).toEqual({ '芝': 1, '中距離': 1 });
  });

  it('距離E → {中距離: 2}（E→C に2枚必要）', () => {
    const bcRace = makeRace({ race_state: 0, distance: 3 });
    expect(calcBCStrategy(bcRace, makeUma({ turf_aptitude: 'A', classic_aptitude: 'E' }))).toEqual({ '中距離': 2 });
  });

  it('ダートBCレース: ダート適性を参照する', () => {
    const bcRace = makeRace({ race_state: 1, distance: 2 });
    expect(calcBCStrategy(bcRace, makeUma({ dirt_aptitude: 'G', mile_aptitude: 'A' }))).toEqual({ 'ダート': 3 });
  });

  it('短距離BCレース: sprint_aptitude を参照する', () => {
    const bcRace = makeRace({ race_state: 0, distance: 1 });
    expect(calcBCStrategy(bcRace, makeUma({ turf_aptitude: 'A', sprint_aptitude: 'E' }))).toEqual({ '短距離': 2 });
  });

  it('長距離BCレース: long_distance_aptitude を参照する', () => {
    const bcRace = makeRace({ race_state: 0, distance: 4 });
    expect(calcBCStrategy(bcRace, makeUma({ turf_aptitude: 'A', long_distance_aptitude: 'F' }))).toEqual({ '長距離': 3 });
  });
});

// ============================================================
// buildAptitudeState
// ============================================================

describe('buildAptitudeState', () => {
  it('UmamusumeRow の各適性フィールドを AptitudeState にマップする', () => {
    const uma = makeUma({
      turf_aptitude: 'S', dirt_aptitude: 'A',
      sprint_aptitude: 'B', mile_aptitude: 'C',
      classic_aptitude: 'D', long_distance_aptitude: 'E',
    });
    expect(buildAptitudeState(uma)).toEqual({
      turf: 'S', dirt: 'A',
      sprint: 'B', mile: 'C',
      classic: 'D', long: 'E',
    });
  });
});

// ============================================================
// applyStrategyToAptitude
// ============================================================

describe('applyStrategyToAptitude', () => {
  const baseApt = { turf: 'G', dirt: 'G', sprint: 'A', mile: 'A', classic: 'A', long: 'A' };

  it('G芝 + 3因子 → D（G→F→E→D）', () => {
    const result = applyStrategyToAptitude(baseApt, { '芝': 3 });
    expect(result.turf).toBe('D');
  });

  it('A芝 + 3因子 → S（上限クリップ）', () => {
    const apt = { ...baseApt, turf: 'A' };
    const result = applyStrategyToAptitude(apt, { '芝': 3 });
    expect(result.turf).toBe('S');
  });

  it('S芝 + 1因子 → S（既にSはクリップ）', () => {
    const apt = { ...baseApt, turf: 'S' };
    const result = applyStrategyToAptitude(apt, { '芝': 1 });
    expect(result.turf).toBe('S');
  });

  it('G芝 + 1因子 → F', () => {
    const result = applyStrategyToAptitude(baseApt, { '芝': 1 });
    expect(result.turf).toBe('F');
  });

  it('複数属性を同時に向上する', () => {
    const result = applyStrategyToAptitude(baseApt, { '芝': 1, 'ダート': 2 });
    expect(result.turf).toBe('F');
    expect(result.dirt).toBe('E');
  });

  it('元のオブジェクトを変更しない（イミュータブル）', () => {
    const apt = { turf: 'G', dirt: 'A', sprint: 'A', mile: 'A', classic: 'A', long: 'A' };
    applyStrategyToAptitude(apt, { '芝': 3 });
    expect(apt.turf).toBe('G');
  });
});

// ============================================================
// raceMatchesAptitude
// ============================================================

describe('raceMatchesAptitude', () => {
  const aptGood = { turf: 'A', dirt: 'A', sprint: 'A', mile: 'A', classic: 'A', long: 'A' };
  const aptWeak = { turf: 'E', dirt: 'E', sprint: 'E', mile: 'E', classic: 'E', long: 'E' };

  describe('bcFinalRace 未指定（通常モード）', () => {
    it('芝C以上かつ中距離C以上 → true', () => {
      expect(raceMatchesAptitude(makeRace({ race_state: 0, distance: 3 }), aptGood)).toBe(true);
    });
    it('芝E（C未満）→ false', () => {
      expect(raceMatchesAptitude(makeRace({ race_state: 0, distance: 3 }), aptWeak)).toBe(false);
    });
    it('ダートC以上かつマイルC以上 → true', () => {
      expect(raceMatchesAptitude(makeRace({ race_state: 1, distance: 2 }), aptGood)).toBe(true);
    });
    it('C境界値（芝C・距離C）→ true', () => {
      const aptC = { turf: 'C', dirt: 'C', sprint: 'C', mile: 'C', classic: 'C', long: 'C' };
      expect(raceMatchesAptitude(makeRace({ race_state: 0, distance: 3 }), aptC)).toBe(true);
    });
  });

  describe('bcFinalRace 指定（BCモード）', () => {
    const bcRace = makeRace({ race_state: 0, distance: 3 });

    it('BCと同じ馬場・距離 → true（適性スコア無関係）', () => {
      expect(raceMatchesAptitude(makeRace({ race_state: 0, distance: 3 }), aptWeak, bcRace)).toBe(true);
    });
    it('馬場が異なる → false', () => {
      expect(raceMatchesAptitude(makeRace({ race_state: 1, distance: 3 }), aptGood, bcRace)).toBe(false);
    });
    it('距離が異なる → false', () => {
      expect(raceMatchesAptitude(makeRace({ race_state: 0, distance: 2 }), aptGood, bcRace)).toBe(false);
    });
  });
});

// ============================================================
// isRaceRunnable
// ============================================================

describe('isRaceRunnable', () => {
  it('芝D・中距離D → true（D=スコア0以上）', () => {
    const apt = { turf: 'D', dirt: 'A', sprint: 'A', mile: 'A', classic: 'D', long: 'A' };
    expect(isRaceRunnable(makeRace({ race_state: 0, distance: 3 }), apt)).toBe(true);
  });

  it('芝E（スコア=-1）→ false', () => {
    const apt = { turf: 'E', dirt: 'A', sprint: 'A', mile: 'A', classic: 'A', long: 'A' };
    expect(isRaceRunnable(makeRace({ race_state: 0, distance: 3 }), apt)).toBe(false);
  });

  it('距離G（スコア=-3）→ false', () => {
    const apt = { turf: 'A', dirt: 'A', sprint: 'A', mile: 'A', classic: 'G', long: 'A' };
    expect(isRaceRunnable(makeRace({ race_state: 0, distance: 3 }), apt)).toBe(false);
  });

  it('ダートD・マイルD → true', () => {
    const apt = { turf: 'A', dirt: 'D', sprint: 'A', mile: 'D', classic: 'A', long: 'A' };
    expect(isRaceRunnable(makeRace({ race_state: 1, distance: 2 }), apt)).toBe(true);
  });

  it('短距離D → true', () => {
    const apt = { turf: 'D', dirt: 'A', sprint: 'D', mile: 'A', classic: 'A', long: 'A' };
    expect(isRaceRunnable(makeRace({ race_state: 0, distance: 1 }), apt)).toBe(true);
  });
});

// ============================================================
// calcRunnableEnhancement
// ============================================================

describe('calcRunnableEnhancement', () => {
  it('既に走れる（芝A・中距離A）→ null', () => {
    const apt = { turf: 'A', dirt: 'A', sprint: 'A', mile: 'A', classic: 'A', long: 'A' };
    expect(calcRunnableEnhancement(makeRace({ race_state: 0, distance: 3 }), apt, null)).toBeNull();
  });

  it('芝E → {芝: 1}（Eから1枚でD）', () => {
    const apt = { turf: 'E', dirt: 'A', sprint: 'A', mile: 'A', classic: 'A', long: 'A' };
    expect(calcRunnableEnhancement(makeRace({ race_state: 0, distance: 3 }), apt, null)).toEqual({ '芝': 1 });
  });

  it('芝G → {芝: 3}（Gから3枚でD）', () => {
    const apt = { turf: 'G', dirt: 'A', sprint: 'A', mile: 'A', classic: 'A', long: 'A' };
    expect(calcRunnableEnhancement(makeRace({ race_state: 0, distance: 3 }), apt, null)).toEqual({ '芝': 3 });
  });

  it('芝E・距離E → {芝: 1, 中距離: 1}', () => {
    const apt = { turf: 'E', dirt: 'A', sprint: 'A', mile: 'A', classic: 'E', long: 'A' };
    expect(calcRunnableEnhancement(makeRace({ race_state: 0, distance: 3 }), apt, null)).toEqual({ '芝': 1, '中距離': 1 });
  });

  it('スロット全消費（6枠使用済み）→ null', () => {
    const apt = { turf: 'E', dirt: 'A', sprint: 'A', mile: 'A', classic: 'A', long: 'A' };
    const currentStrategy = { '短距離': 2, 'マイル': 2, 'ダート': 2 }; // 合計6
    expect(calcRunnableEnhancement(makeRace({ race_state: 0, distance: 3 }), apt, currentStrategy)).toBeNull();
  });

  it('必要因子数がフリースロット超過 → null', () => {
    // 芝G(3枚) + 中距離G(3枚) = 6枚必要、既存1枠使用でフリー5枠 → 不足
    const apt = { turf: 'G', dirt: 'A', sprint: 'A', mile: 'A', classic: 'G', long: 'A' };
    const currentStrategy = { '短距離': 1 }; // 合計1 → フリー5
    expect(calcRunnableEnhancement(makeRace({ race_state: 0, distance: 3 }), apt, currentStrategy)).toBeNull();
  });

  it('ダート短距離レース: ダート適性不足を補修', () => {
    const apt = { turf: 'A', dirt: 'F', sprint: 'A', mile: 'A', classic: 'A', long: 'A' };
    expect(calcRunnableEnhancement(makeRace({ race_state: 1, distance: 1 }), apt, null)).toEqual({ 'ダート': 2 });
  });
});

// ============================================================
// calculateFactorComposition
// ============================================================

describe('calculateFactorComposition', () => {
  it('常に6要素を返す（全A適性・戦略なし）', () => {
    expect(calculateFactorComposition(makeUma(), [])).toHaveLength(6);
  });

  it('常に6要素を返す（戦略あり）', () => {
    expect(calculateFactorComposition(makeUma(), [makeRace()], { '芝': 2 })).toHaveLength(6);
  });

  it('芝G・中距離G + 芝中距離レースのみ → 芝3・中距離3（G→D補修）', () => {
    const uma = makeUma({ turf_aptitude: 'G', classic_aptitude: 'G' });
    const races = [
      makeRace({ race_state: 0, distance: 3 }),
      makeRace({ race_state: 0, distance: 3 }),
    ];
    const result = calculateFactorComposition(uma, races);
    expect(result).toHaveLength(6);
    expect(result.filter((f) => f === '芝')).toHaveLength(3);
    expect(result.filter((f) => f === '中距離')).toHaveLength(3);
  });

  it('戦略あり: 戦略因子が出力に含まれる', () => {
    const uma = makeUma({ turf_aptitude: 'G' });
    const result = calculateFactorComposition(uma, [makeRace({ race_state: 0, distance: 3 })], { '芝': 2 });
    expect(result.filter((f) => f === '芝').length).toBeGreaterThanOrEqual(2);
  });

  it('戦略あり・残スロット不足分は 自由 で埋められる', () => {
    // 全A適性、戦略{芝:3}、パターン芝レースのみ → 残3スロットは自由
    const uma = makeUma();
    const result = calculateFactorComposition(uma, [makeRace({ race_state: 0, distance: 3 })], { '芝': 3 });
    expect(result.filter((f) => f === '芝')).toHaveLength(3);
    expect(result.filter((f) => f === '自由')).toHaveLength(3);
  });

  it('isLarc=true: 戦略から芝・中距離が除外される', () => {
    const uma = makeUma({ dirt_aptitude: 'G' });
    const result = calculateFactorComposition(
      uma,
      [makeRace({ race_state: 1, distance: 2 })],
      { '芝': 2, 'ダート': 1 },
      true,
    );
    expect(result.filter((f) => f === '芝')).toHaveLength(0);
    expect(result.filter((f) => f === 'ダート').length).toBeGreaterThanOrEqual(1);
  });

  it('isLarc=true: 芝・中距離適性をAとして扱うため補修不要', () => {
    // ラーク時は turf/classic が強制的に A 扱い → 芝・中距離因子は自動補修されない
    const uma = makeUma({ turf_aptitude: 'G', classic_aptitude: 'G' });
    const result = calculateFactorComposition(uma, [makeRace({ race_state: 0, distance: 3 })], null, true);
    // isLarc で芝・中距離は補修対象外 → 自由で埋まる
    expect(result.filter((f) => f === '自由').length).toBeGreaterThan(0);
  });

  it('出力は FACTOR_SORT_ORDER でソートされる（芝 < ダート < 距離 < 自由）', () => {
    const uma = makeUma({ turf_aptitude: 'G', classic_aptitude: 'G' });
    const result = calculateFactorComposition(uma, [makeRace({ race_state: 0, distance: 3 })]);
    // 自由より前には馬場/距離因子が来る
    const firstJiyuIdx = result.indexOf('自由');
    if (firstJiyuIdx >= 0) {
      for (let i = 0; i < firstJiyuIdx; i++) {
        expect(['芝', 'ダート', '短距離', 'マイル', '中距離', '長距離']).toContain(result[i]);
      }
    }
    // 先頭要素が自由でなければ芝かダート
    if (result[0] !== '自由') {
      const order: Record<string, number> = { '芝': 0, 'ダート': 1, '短距離': 2, 'マイル': 3, '中距離': 4, '長距離': 5, '自由': 99 };
      for (let i = 1; i < result.length; i++) {
        expect((order[result[i]] ?? 98)).toBeGreaterThanOrEqual(order[result[i - 1]] ?? 0);
      }
    }
  });
});
