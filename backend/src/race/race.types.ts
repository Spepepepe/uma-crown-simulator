// =============================================
// Uma Crown Simulator - バックエンド内部型定義
// Backend (NestJS) 専用
// =============================================

import type { RaceTable, UmamusumeTable, Prisma } from '@prisma/client';

/** race_table の行型 (Prisma 生成型) */
export type RaceRow = RaceTable;

/** umamusume_table の行型 (Prisma 生成型) */
export type UmamusumeRow = UmamusumeTable;

/** scenario_race_table + JOIN race の行型 (Prisma 生成型) */
export type ScenarioRaceRow = Prisma.ScenarioRaceTableGetPayload<{
  include: { race: true };
}>;

/**
 * レースパターン内の 1 スロットに割り当てられたレース情報 (backend 内部用)
 * フロント共通の RaceSlot とは異なり、race_id が null（空スロット）を許容する
 */
export interface RaceSlotData {
  /** レース名 */
  race_name: string;
  /** レース ID（空スロットの場合は null） */
  race_id: number | null;
  /** 距離カテゴリ（1=短距離〜4=長距離。空スロットの場合は null） */
  distance: number | null;
  /** 馬場種別（0=芝, 1=ダート。空スロットの場合は null） */
  race_state: number | null;
  /** グレード（1=G1, 2=G2, 3=G3。空スロットの場合は null） */
  race_rank: number | null;
  /** 開催月（1〜12） */
  month: number;
  /** 前後半フラグ（false=前半, true=後半） */
  half: boolean;
}

/**
 * ウマ娘の現在適性状態
 * 因子補修により G→F→E のように段階的に向上する
 */
export interface AptitudeState {
  /** 芝適性 (S/A/B/C/D/E/F/G) */
  turf: string;
  /** ダート適性 (S/A/B/C/D/E/F/G) */
  dirt: string;
  /** 短距離適性 (S/A/B/C/D/E/F/G) */
  sprint: string;
  /** マイル適性 (S/A/B/C/D/E/F/G) */
  mile: string;
  /** 中距離適性 (S/A/B/C/D/E/F/G) */
  classic: string;
  /** 長距離適性 (S/A/B/C/D/E/F/G) */
  long: string;
}

/**
 * registerOne / registerPattern のリクエストで受け取るレース情報
 * `race_id` は必須、`race_name` は省略可能（省略時は ID をラベル代替に使用）
 */
export interface RaceInput {
  /** レース ID */
  race_id: number;
  /** レース名（省略可能） */
  race_name?: string;
}

/**
 * getRemaining の戻り値の要素型
 * ウマ娘ごとの残レース集計データ
 */
export interface RemainingRaceEntry {
  /** 対象ウマ娘の行データ */
  umamusume: UmamusumeRow;
  /** 全冠達成済みかどうか */
  isAllCrown: boolean;
  /** 全冠対象残レース数合計 */
  allCrownRace: number;
  /** 芝・短距離の残レース数 */
  turfSprintRace: number;
  /** 芝・マイルの残レース数 */
  turfMileRace: number;
  /** 芝・中距離の残レース数 */
  turfClassicRace: number;
  /** 芝・長距離の残レース数 */
  turfLongDistanceRace: number;
  /** ダート・短距離の残レース数 */
  dirtSprintDistanceRace: number;
  /** ダート・マイルの残レース数 */
  dirtMileRace: number;
  /** ダート・中距離の残レース数 */
  dirtClassicRace: number;
}

/**
 * 育成パターンデータ（サービス内部の中間表現）
 * buildPatternFromGrid で生成され、Phase 9 後処理で各フィールドが設定される
 */
export interface PatternData {
  /** ジュニア期のレーススロット配列 */
  junior: RaceSlotData[];
  /** クラシック期のレーススロット配列 */
  classic: RaceSlotData[];
  /** シニア期のレーススロット配列 */
  senior: RaceSlotData[];
  /** シナリオ種別（'bc' | 'larc'） */
  scenario?: string;
  /** 因子戦略（各因子の推奨枚数。null = B パターン） */
  strategy?: Record<string, number> | null;
  /** 因子補修適用後の適性状態 */
  aptitudeState?: AptitudeState;
  /** 推奨因子構成（6 枠分） */
  factors?: string[];
  /** パターン内の総出走レース数 */
  totalRaces?: number;
  /** 主馬場種別の日本語名称 */
  surface?: string;
  /** 主距離カテゴリの日本語名称 */
  distance?: string;
  [key: string]: unknown;
}
