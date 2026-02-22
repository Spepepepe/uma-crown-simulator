// =============================================
// Uma Crown Simulator - ドメインモデル型定義
// Frontend (Angular) / Backend (NestJS) 共通
// =============================================

/**
 * ウマ娘の基本情報と各種適性を表すエンティティ
 */
export interface Umamusume {
  /** ウマ娘 ID (PK) */
  umamusume_id: number;
  /** ウマ娘名 */
  umamusume_name: string;
  /** 芝適性 (S / A / B / C / D / E / F / G) */
  turf_aptitude: string;
  /** ダート適性 (S / A / B / C / D / E / F / G) */
  dirt_aptitude: string;
  /** 逃げ適性 (S / A / B / C / D / E / F / G) */
  front_runner_aptitude: string;
  /** 先行適性 (S / A / B / C / D / E / F / G) */
  early_foot_aptitude: string;
  /** 差し適性 (S / A / B / C / D / E / F / G) */
  midfield_aptitude: string;
  /** 追込適性 (S / A / B / C / D / E / F / G) */
  closer_aptitude: string;
  /** 短距離適性 (S / A / B / C / D / E / F / G) */
  sprint_aptitude: string;
  /** マイル適性 (S / A / B / C / D / E / F / G) */
  mile_aptitude: string;
  /** 中距離適性 (S / A / B / C / D / E / F / G) */
  classic_aptitude: string;
  /** 長距離適性 (S / A / B / C / D / E / F / G) */
  long_distance_aptitude: string;
}

/**
 * ユーザーが登録済みのウマ娘（ウマ娘詳細を含む）
 */
export interface RegistUmamusume {
  /** 登録ウマ娘の詳細情報 */
  umamusume: Umamusume;
}

/**
 * レースの基本情報を表すエンティティ
 */
export interface Race {
  /** レース ID (PK) */
  race_id: number;
  /** レース名 */
  race_name: string;
  /** 馬場種別 (0: 芝, 1: ダート) */
  race_state: number;
  /** 距離カテゴリ (1: 短距離, 2: マイル, 3: 中距離, 4: 長距離) */
  distance: number;
  /** 距離詳細 (メートル単位。未設定の場合は null) */
  distance_detail: number | null;
  /** 必要ファン数 */
  num_fans: number;
  /** グレード (1: G1, 2: G2, 3: G3) */
  race_rank: number;
  /** シニア期に出走可能かどうか */
  senior_flag: boolean;
  /** クラシック期に出走可能かどうか */
  classic_flag: boolean;
  /** ジュニア期に出走可能かどうか */
  junior_flag: boolean;
  /** 開催月 (1〜12) */
  race_months: number;
  /** 前後半フラグ (false: 前半, true: 後半) */
  half_flag: boolean;
  /** シナリオ固定レースかどうか */
  scenario_flag: boolean;
  /** UI チェック状態（オプション。フロントエンドでの選択管理用） */
  checked?: boolean;
}

/**
 * ウマ娘ごとの全冠達成に向けた残レース集計
 */
export interface RemainingRace {
  /** 対象ウマ娘の詳細情報 */
  umamusume: Umamusume;
  /** 全冠達成済みかどうか */
  isAllCrown: boolean;
  /** 全冠対象残レース数の合計 */
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
 * 育成パターン内の 1 スロット（月・前後半）に割り当てられたレース
 */
export interface RaceSlot {
  /** レース ID */
  race_id: number;
  /** レース名 */
  race_name: string;
  /** 馬場種別 (0: 芝, 1: ダート) */
  race_state: number;
  /** 距離カテゴリ (1: 短距離, 2: マイル, 3: 中距離, 4: 長距離) */
  distance: number;
  /** 開催月 (1〜12) */
  month: number;
  /** 前後半フラグ (false: 前半, true: 後半) */
  half: boolean;
}

/**
 * 1 育成ローテーション分のレース配置パターン
 */
export interface RacePattern {
  /** シナリオ名 ('伝説' / 'ラーク' / 'メイクラ') */
  scenario: string;
  /** 因子戦略（各因子の推奨枚数。例: `{ '芝': 3, '短距離': 3 }`) */
  strategy: Record<string, number>;
  /** パターンで最も多く出走する馬場種別の名称 */
  surface: string;
  /** パターンで最も多く出走する距離カテゴリの名称 */
  distance: string;
  /** ジュニア期のレーススロット一覧 */
  junior: RaceSlot[];
  /** クラシック期のレーススロット一覧 */
  classic: RaceSlot[];
  /** シニア期のレーススロット一覧 */
  senior: RaceSlot[];
  /** 推奨因子構成（6 枠分。例: `['芝', '芝', '中距離', '中距離', '自由', '自由']`) */
  factors: string[];
  /** パターン内の総出走レース数 */
  totalRaces: number;
}

/**
 * シナリオ固定レースの割り当て情報
 */
export interface ScenarioRace {
  /** 対象ウマ娘 ID */
  umamusume_id: number;
  /** 対象レース ID */
  race_id: number;
  /** シナリオ内での出走順番号 */
  race_number: number;
  /** ランダムグループ（複数のランダム選択肢を持つ場合に使用。null の場合は固定） */
  random_group: number | null;
  /** シニア期専用フラグ (null: 期問わず, false: クラシック期, true: シニア期) */
  senior_flag: boolean | null;
}

/**
 * 育成期カテゴリ
 * - `junior`: ジュニア期 (7〜12 月)
 * - `classic`: クラシック期 (1〜12 月)
 * - `senior`: シニア期 (1〜12 月)
 */
export type GradeName = 'junior' | 'classic' | 'senior';

/**
 * レース一覧画面のグレードタブ
 */
export type RaceTab = 'G1' | 'G2' | 'G3';

/**
 * 残レース一覧画面の月別スロット（前半・後半それぞれのレース割り当てを保持）
 */
export interface MonthSlot {
  /** 月 (1〜12) */
  month: number;
  /** 前半スロットのレース（未割り当ての場合は null） */
  first: RaceSlot | null;
  /** 後半スロットのレース（未割り当ての場合は null） */
  second: RaceSlot | null;
}
