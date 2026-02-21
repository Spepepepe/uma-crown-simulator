// =============================================
// Uma Crown Simulator - ドメインモデル型定義
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

// --- シナリオレース ---
export interface ScenarioRace {
  umamusume_id: number;
  race_id: number;
  race_number: number;
  random_group: number | null;
  senior_flag: boolean | null;
}

// --- 育成期カテゴリ ---
export type GradeName = 'junior' | 'classic' | 'senior';

// --- レースタブ ---
export type RaceTab = 'G1' | 'G2' | 'G3';

// --- 月別スロット ---
export interface MonthSlot {
  month: number;
  first: RaceSlot | null;
  second: RaceSlot | null;
}
