import type { UmamusumeTable } from '@prisma/client';
import { toUmamusumeResponse, toRegisteredUmamusumeResponse } from '@src/umamusume/umamusume.mapper.js';

/**
 * 対象: src/umamusume/umamusume.mapper.ts
 *
 * Prisma モデル → Response DTO の変換ロジックを検証する。
 */

/** テスト用ウマ娘レコードを生成する */
function makeUmamusume(overrides: Partial<UmamusumeTable> = {}): UmamusumeTable {
  return {
    umamusume_id: 1,
    umamusume_name: 'ゴールドシップ',
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
    ...overrides,
  };
}

describe('toUmamusumeResponse', () => {
  it('Prisma の snake_case フィールドを camelCase に変換する', () => {
    const row = makeUmamusume();
    const result = toUmamusumeResponse(row);

    expect(result).toEqual({
      umamusumeId: 1,
      umamusumeName: 'ゴールドシップ',
      turfAptitude: 'A',
      dirtAptitude: 'B',
      frontRunnerAptitude: 'G',
      earlyFootAptitude: 'C',
      midfieldAptitude: 'A',
      closerAptitude: 'A',
      sprintAptitude: 'G',
      mileAptitude: 'C',
      classicAptitude: 'A',
      longDistanceAptitude: 'A',
    });
  });

  it('レスポンスに Prisma 固有のフィールドが含まれない', () => {
    const row = makeUmamusume();
    const result = toUmamusumeResponse(row);

    expect(result).not.toHaveProperty('umamusume_id');
    expect(result).not.toHaveProperty('umamusume_name');
    expect(result).not.toHaveProperty('turf_aptitude');
  });
});

describe('toRegisteredUmamusumeResponse', () => {
  it('umamusume リレーションを UmamusumeResponse に変換してラップする', () => {
    const row = { umamusume: makeUmamusume() };
    const result = toRegisteredUmamusumeResponse(row);

    expect(result.umamusume.umamusumeId).toBe(1);
    expect(result.umamusume.umamusumeName).toBe('ゴールドシップ');
  });

  it('レスポンスが RegisteredUmamusumeResponse の構造に一致する', () => {
    const row = { umamusume: makeUmamusume({ umamusume_id: 42 }) };
    const result = toRegisteredUmamusumeResponse(row);

    expect(Object.keys(result)).toEqual(['umamusume']);
    expect(result.umamusume.umamusumeId).toBe(42);
  });
});
