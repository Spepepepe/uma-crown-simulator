import type { UmamusumeTable } from '@prisma/client';
import type { UmamusumeResponse, RegisteredUmamusumeResponse } from '@uma-crown/shared';

/**
 * UmamusumeTable → UmamusumeResponse に変換する
 * @param row - Prisma のウマ娘レコード
 * @returns API レスポンス用のウマ娘情報
 */
export function toUmamusumeResponse(row: UmamusumeTable): UmamusumeResponse {
  return {
    umamusumeId: row.umamusume_id,
    umamusumeName: row.umamusume_name,
    turfAptitude: row.turf_aptitude,
    dirtAptitude: row.dirt_aptitude,
    frontRunnerAptitude: row.front_runner_aptitude,
    earlyFootAptitude: row.early_foot_aptitude,
    midfieldAptitude: row.midfield_aptitude,
    closerAptitude: row.closer_aptitude,
    sprintAptitude: row.sprint_aptitude,
    mileAptitude: row.mile_aptitude,
    classicAptitude: row.classic_aptitude,
    longDistanceAptitude: row.long_distance_aptitude,
  };
}

/**
 * 登録済みウマ娘レコード → RegisteredUmamusumeResponse に変換する
 * @param row - Prisma の登録ウマ娘レコード（umamusume リレーション含む）
 * @returns API レスポンス用の登録済みウマ娘情報
 */
export function toRegisteredUmamusumeResponse(
  row: { umamusume: UmamusumeTable },
): RegisteredUmamusumeResponse {
  return {
    umamusume: toUmamusumeResponse(row.umamusume),
  };
}
