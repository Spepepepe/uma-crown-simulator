// =============================================
// race-pattern 専用内部型定義
// race-pattern.service.ts 内のみで使用する中間型
// =============================================

import type { RaceRow, UmamusumeRow, AptitudeState } from '../race.types.js';

/**
 * Phase 1 で取得した DB データをまとめた中間型
 * `fetchRaceData` の戻り値として使用する
 */
export interface FetchedRaceData {
  /** 対象ウマ娘の行データ */
  umaData: UmamusumeRow;
  /** 全 G1/G2/G3 + BC 必須中間レースの RaceRow 配列 */
  allGRaces: RaceRow[];
  /** 未出走の残レース配列（allGRaces から出走済みを除いたもの） */
  remainingRacesAll: RaceRow[];
  /** ラークシナリオ関連の残レースが存在する場合 true */
  hasRemainingLarc: boolean;
  /** 出走済みレース ID のセット */
  registRaceIds: Set<number>;
}

/**
 * Phase 3-5 で初期化した BC パターン構造をまとめた中間型
 * `initializeBCPatterns` の戻り値として使用する
 */
export interface BCPatternsInit {
  /** A パターン先頭でソート済みの BC 最終レース配列 */
  sortedBCRaces: RaceRow[];
  /** BC パターン数分のグリッド（スロットキー → RaceRow のマップ）配列 */
  grid: Map<string, RaceRow>[];
  /** 各パターンの因子戦略（null = B パターン / 自動計算） */
  patternStrategies: (Record<string, number> | null)[];
  /** 因子戦略適用済みの各パターン適性状態 */
  aptitudeStates: AptitudeState[];
  /** Phase 4 で強制配置済みの BC 中間レース ID セット */
  bcMandatoryPrePlacedIds: Set<number>;
  /** Phase 6 以降で割り当て対象となるレース配列 */
  racesToAssign: RaceRow[];
}
