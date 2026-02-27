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

/** レースパターン内のスロット (backend 内部用) */
export interface RaceSlotData {
  race_name: string;
  race_id: number | null;
  distance: number | null;
  race_state: number | null;
  race_rank: number | null;
  month: number;
  half: boolean;
}

/** ウマ娘の現在適性状態（因子一段階につき G→F, F→E のように向上） */
export interface AptitudeState {
  turf: string;    // 芝適性 (S/A/B/C/D/E/F/G)
  dirt: string;    // ダート適性
  sprint: string;  // 短距離適性
  mile: string;    // マイル適性
  classic: string; // 中距離適性
  long: string;    // 長距離適性
}

/** 育成パターンデータ */
export interface PatternData {
  junior: RaceSlotData[];
  classic: RaceSlotData[];
  senior: RaceSlotData[];
  scenario?: string;
  strategy?: Record<string, number> | null;
  aptitudeState?: AptitudeState;
  factors?: string[];
  totalRaces?: number;
  surface?: string;
  distance?: string;
  [key: string]: any;
}
