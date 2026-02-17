// =============================================
// Uma Crown Simulator - 共通型定義
// Frontend (Angular) / Backend (NestJS) 共通
// =============================================

// --- ウマ娘 ---
export interface Umamusume {
  umamusume_id: number;
  umamusume_name: string;
  turf_aptitude: string;
  dirt_aptitude: string;
  front_runner_aptitude: string;
  early_foot_aptitude: string;
  midfield_aptitude: string;
  closer_aptitude: string;
  sprint_aptitude: string;
  mile_aptitude: string;
  classic_aptitude: string;
  long_distance_aptitude: string;
}

// --- 登録済みウマ娘 ---
export interface RegistUmamusume {
  umamusume: Umamusume;
}

// --- レース ---
export interface Race {
  race_id: number;
  race_name: string;
  race_state: number; // 0: 芝, 1: ダート
  distance: number; // 1: 短距離, 2: マイル, 3: 中距離, 4: 長距離
  distance_detail: number | null;
  num_fans: number;
  race_rank: number; // 1: G1, 2: G2, 3: G3
  senior_flag: boolean;
  classic_flag: boolean;
  junior_flag: boolean;
  race_months: number; // 1-12
  half_flag: boolean; // false: 前半, true: 後半
  scenario_flag: boolean;
  checked?: boolean;
}

// --- 残レース ---
export interface RemainingRace {
  umamusume: Umamusume;
  isAllCrown: boolean;
  breedingCount: number;
  allCrownRace: number;
  turfSprintRace: number;
  turfMileRace: number;
  turfClassicRace: number;
  turfLongDistanceRace: number;
  dirtSprintDistanceRace: number;
  dirtMileRace: number;
  dirtClassicRace: number;
}

// --- レースパターン ---
export interface RaceSlot {
  race_id: number;
  race_name: string;
  race_state: number;
  distance: number;
  month: number;
  half: boolean;
}

export interface RacePattern {
  scenario: string;
  strategy: Record<string, number>;
  surface: string;
  distance: string;
  junior: RaceSlot[];
  classic: RaceSlot[];
  senior: RaceSlot[];
  factors: string[];
  totalRaces: number;
}

export interface RacePatternResponse {
  patterns: RacePattern[];
}

// --- シナリオレース ---
export interface ScenarioRace {
  umamusume_id: number;
  race_id: number;
  race_number: number;
  random_group: number | null;
  senior_flag: boolean | null;
}

// --- 残レース → 出走画面用 props ---
export interface RemainingToRaceProps {
  season: number; // 1: ジュニア, 2: クラシック, 3: シニア
  month: number;
  half: boolean; // false: 前半, true: 後半
  isRaceReturn?: boolean;
  isRaceForward?: boolean;
}

// --- 認証 ---
export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  token?: string;
  refresh?: string;
}

// =============================================
// DB Row Types (Backend services / Prisma)
// =============================================

/** race_table の完全な行型 */
export interface RaceRow {
  race_id: number;
  race_name: string;
  race_state: number;
  distance: number;
  distance_detail: number | null;
  num_fans: number;
  race_months: number;
  half_flag: boolean;
  race_rank: number;
  junior_flag: boolean;
  classic_flag: boolean;
  senior_flag: boolean;
  scenario_flag: boolean;
  [key: string]: any;
}

/** scenario_race_table + JOIN race */
export interface ScenarioRaceRow {
  umamusume_id: number;
  race_id: number;
  race_number: number;
  random_group: number | null;
  senior_flag: boolean | null;
  race: RaceRow;
}

/** umamusume_table の完全な行型 */
export type UmamusumeRow = Umamusume;

/** レースパターン内のスロット (backend 内部用) */
export interface RaceSlotData {
  race_name: string;
  race_id: number | null;
  distance: number | null;
  race_state: number | null;
  month: number;
  half: boolean;
}

/** 育成パターンデータ */
export interface PatternData {
  junior: RaceSlotData[];
  classic: RaceSlotData[];
  senior: RaceSlotData[];
  scenario?: string;
  strategy?: Record<string, number> | null;
  factors?: string[];
  totalRaces?: number;
  surface?: string;
  distance?: string;
  [key: string]: any;
}

export type GradeName = 'junior' | 'classic' | 'senior';
