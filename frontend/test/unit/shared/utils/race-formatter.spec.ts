import { getRaceRank, getDistanceLabel, getRunSeason } from '../../../../src/app/shared/utils/race-formatter';
import type { Race } from '@shared/types';

/**
 * 対象: src/app/shared/utils/race-formatter.ts
 */

describe('race-formatter', () => {

  // ─────────────────────────────────────────────
  // getRaceRank
  // ─────────────────────────────────────────────
  describe('getRaceRank', () => {
    it('1 → GI を返す', () => {
      expect(getRaceRank(1)).toBe('GI');
    });

    it('2 → GII を返す', () => {
      expect(getRaceRank(2)).toBe('GII');
    });

    it('3 → GIII を返す', () => {
      expect(getRaceRank(3)).toBe('GIII');
    });

    it('未定義の値は空文字を返す', () => {
      expect(getRaceRank(0)).toBe('');
      expect(getRaceRank(99)).toBe('');
    });
  });

  // ─────────────────────────────────────────────
  // getDistanceLabel
  // ─────────────────────────────────────────────
  describe('getDistanceLabel', () => {
    it('1 → 短距離 を返す', () => {
      expect(getDistanceLabel(1)).toBe('短距離');
    });

    it('2 → マイル を返す', () => {
      expect(getDistanceLabel(2)).toBe('マイル');
    });

    it('3 → 中距離 を返す', () => {
      expect(getDistanceLabel(3)).toBe('中距離');
    });

    it('4 → 長距離 を返す', () => {
      expect(getDistanceLabel(4)).toBe('長距離');
    });

    it('未定義の値は空文字を返す', () => {
      expect(getDistanceLabel(0)).toBe('');
      expect(getDistanceLabel(99)).toBe('');
    });
  });

  // ─────────────────────────────────────────────
  // getRunSeason
  // ─────────────────────────────────────────────
  describe('getRunSeason', () => {
    const baseRace: Race = {
      race_id: 1,
      race_name: 'テスト',
      race_state: 0,
      distance: 3,
      distance_detail: null,
      num_fans: 0,
      race_rank: 1,
      senior_flag: false,
      classic_flag: false,
      junior_flag: false,
      race_months: 1,
      half_flag: false,
      scenario_flag: false,
    };

    it('全フラグOFFのとき空文字を返す', () => {
      expect(getRunSeason(baseRace)).toBe('');
    });

    it('ジュニアのみのとき "ジュニア" を返す', () => {
      expect(getRunSeason({ ...baseRace, junior_flag: true })).toBe('ジュニア');
    });

    it('全フラグONのとき "ジュニア / クラシック / シニア" を返す', () => {
      expect(getRunSeason({ ...baseRace, junior_flag: true, classic_flag: true, senior_flag: true }))
        .toBe('ジュニア / クラシック / シニア');
    });

    it('クラシック・シニアのとき "クラシック / シニア" を返す', () => {
      expect(getRunSeason({ ...baseRace, classic_flag: true, senior_flag: true }))
        .toBe('クラシック / シニア');
    });
  });
});
