import {
  gradeBg,
  gradeBadge,
  gradeColor,
  getDistanceBgColor,
  getSurfaceBgColor,
  getRaceCountClass,
  getRaceCountDisplay,
} from '../../../../src/app/shared/utils/color-mapper';

/**
 * 対象: src/app/shared/utils/color-mapper.ts
 */

describe('color-mapper', () => {

  // ─────────────────────────────────────────────
  // gradeBg
  // ─────────────────────────────────────────────
  describe('gradeBg', () => {
    it('1(G1) → amber グラデーションを返す', () => {
      expect(gradeBg(1)).toContain('amber');
    });

    it('2(G2) → slate グラデーションを返す', () => {
      expect(gradeBg(2)).toContain('slate');
    });

    it('3(G3) → orange グラデーションを返す', () => {
      expect(gradeBg(3)).toContain('orange');
    });

    it('未定義の値は gray グラデーションを返す', () => {
      expect(gradeBg(0)).toContain('gray');
    });
  });

  // ─────────────────────────────────────────────
  // gradeBadge
  // ─────────────────────────────────────────────
  describe('gradeBadge', () => {
    it('1(G1) → amber バッジを返す', () => {
      expect(gradeBadge(1)).toContain('amber');
    });

    it('2(G2) → slate バッジを返す', () => {
      expect(gradeBadge(2)).toContain('slate');
    });

    it('3(G3) → orange バッジを返す', () => {
      expect(gradeBadge(3)).toContain('orange');
    });

    it('未定義の値は gray バッジを返す', () => {
      expect(gradeBadge(99)).toContain('gray');
    });
  });

  // ─────────────────────────────────────────────
  // gradeColor
  // ─────────────────────────────────────────────
  describe('gradeColor', () => {
    it.each([
      ['S', 'amber'],
      ['A', 'rose'],
      ['B', 'orange'],
      ['C', 'lime'],
      ['D', 'cyan'],
      ['E', 'indigo'],
      ['F', 'slate'],
      ['G', 'gray-400'],
    ])('%s → %s を含むクラスを返す', (grade, expected) => {
      expect(gradeColor(grade)).toContain(expected);
    });

    it('未定義の値は gray-300 を返す', () => {
      expect(gradeColor('Z')).toContain('gray-300');
    });
  });

  // ─────────────────────────────────────────────
  // getDistanceBgColor
  // ─────────────────────────────────────────────
  describe('getDistanceBgColor', () => {
    it('1(短距離) → pink を返す', () => {
      expect(getDistanceBgColor(1)).toContain('pink');
    });

    it('2(マイル) → green を返す', () => {
      expect(getDistanceBgColor(2)).toContain('green');
    });

    it('3(中距離) → yellow を返す', () => {
      expect(getDistanceBgColor(3)).toContain('yellow');
    });

    it('4(長距離) → blue を返す', () => {
      expect(getDistanceBgColor(4)).toContain('blue');
    });

    it('未定義の値は gray を返す', () => {
      expect(getDistanceBgColor(0)).toContain('gray');
    });
  });

  // ─────────────────────────────────────────────
  // getSurfaceBgColor
  // ─────────────────────────────────────────────
  describe('getSurfaceBgColor', () => {
    it('0(芝) → lime を返す', () => {
      expect(getSurfaceBgColor(0)).toContain('lime');
    });

    it('1(ダート) → amber を返す', () => {
      expect(getSurfaceBgColor(1)).toContain('amber');
    });
  });

  // ─────────────────────────────────────────────
  // getRaceCountClass
  // ─────────────────────────────────────────────
  describe('getRaceCountClass', () => {
    it('0 → yellow（全冠色）を返す', () => {
      expect(getRaceCountClass(0)).toContain('yellow');
    });

    it('1 → green を返す', () => {
      expect(getRaceCountClass(1)).toContain('green');
    });

    it('2 → green を返す', () => {
      expect(getRaceCountClass(2)).toContain('green');
    });

    it('3以上 → red を返す', () => {
      expect(getRaceCountClass(3)).toContain('red');
      expect(getRaceCountClass(10)).toContain('red');
    });
  });

  // ─────────────────────────────────────────────
  // getRaceCountDisplay
  // ─────────────────────────────────────────────
  describe('getRaceCountDisplay', () => {
    it('0 → 王冠絵文字を返す', () => {
      expect(getRaceCountDisplay(0)).toBe('👑');
    });

    it('1以上 → 数値文字列を返す', () => {
      expect(getRaceCountDisplay(1)).toBe('1');
      expect(getRaceCountDisplay(5)).toBe('5');
    });
  });
});
