// =============================================
// Uma Crown Simulator - API リクエスト/レスポンス型
// Frontend (Angular) / Backend (NestJS) 共通
// =============================================

import type { RacePattern } from './domain';

// --- レースパターン ---
export interface RacePatternResponse {
  patterns: RacePattern[];
  umamusumeName?: string;
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
