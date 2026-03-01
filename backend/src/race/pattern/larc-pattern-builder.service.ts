import { Injectable } from '@nestjs/common';
import type { RaceRow, UmamusumeRow, AptitudeState } from '../race.types.js';
import { LARC_MANDATORY, RANK_ORDER } from './pattern.constants.js';
import {
  sk,
  getAvailableSlots,
  isLarcRestrictedSlot,
  isConsecutiveViolation,
  buildAptitudeState,
  isRaceRunnable,
} from './pattern.helpers.js';

/**
 * ラークシナリオのパターン生成を担うサービス
 *
 * - `buildLarcAptitudeState`: ラークシナリオ補正後の適性状態を生成
 * - `buildLarcGrid`: ラークパターンのグリッドを構築
 *
 * PrismaService への依存はなく、純粋なアルゴリズムのみを扱うため単体テストが容易。
 */
@Injectable()
export class LarcPatternBuilderService {
  /**
   * ラークシナリオ補正後の適性状態を生成する
   * ラークシナリオでは芝・中距離適性がシナリオ補正により最低 A になる
   * @param umaData - 対象ウマ娘の行データ
   * @returns ラークシナリオ補正済みの適性状態オブジェクト
   */
  buildLarcAptitudeState(umaData: UmamusumeRow): AptitudeState {
    const base = buildAptitudeState(umaData);
    const maxRank = (rank: string, min: string): string =>
      RANK_ORDER.indexOf(rank as (typeof RANK_ORDER)[number]) >=
      RANK_ORDER.indexOf(min as (typeof RANK_ORDER)[number])
        ? rank
        : min;
    return { ...base, turf: maxRank(base.turf, 'A'), classic: maxRank(base.classic, 'A') };
  }

  /**
   * Phase 8: ラークパターンのグリッドを構築する
   * LARC_MANDATORY を強制配置し、未割り当て残レースをラーク制限を考慮して配置する
   * @param racesToAssign - 割り当て対象の残レース配列
   * @param assignedRaceIds - Phase 6 までに割り当て済みのレース ID セット
   * @param allGRaces - 全 G1/G2/G3 レース配列（LARC_MANDATORY 検索に使用。出走済み含む）
   * @param larcAptState - ラークシナリオ補正済みの適性状態
   * @returns 構築済みのラークパターングリッド
   */
  buildLarcGrid(
    racesToAssign: RaceRow[],
    assignedRaceIds: Set<number>,
    allGRaces: RaceRow[],
    larcAptState: AptitudeState,
  ): Map<string, RaceRow> {
    const larcGrid: Map<string, RaceRow> = new Map();

    for (const [grade, name, month, half] of LARC_MANDATORY) {
      const slotK = sk(grade, month, half);
      if (larcGrid.has(slotK)) continue;
      const larcRace = allGRaces.find((r) => r.race_name === name);
      if (larcRace) larcGrid.set(slotK, larcRace);
    }

    for (const race of racesToAssign) {
      if (assignedRaceIds.has(race.race_id)) continue;
      if (!isRaceRunnable(race, larcAptState)) continue;
      let placed = false;
      for (const slot of getAvailableSlots(race)) {
        if (placed) break;
        const slotK = sk(slot.grade, slot.month, slot.half);
        if (larcGrid.has(slotK)) continue;
        if (isLarcRestrictedSlot(slot.grade, slot.month, slot.half)) continue;
        if (isConsecutiveViolation(larcGrid, slotK)) continue;
        larcGrid.set(slotK, race);
        placed = true;
      }
    }

    return larcGrid;
  }
}
