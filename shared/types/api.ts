// =============================================
// Uma Crown Simulator - API リクエスト/レスポンス型
// Frontend (Angular) / Backend (NestJS) 共通
// =============================================

import type { RacePattern } from './domain';

/**
 * `GET /races/pattern/:id` のレスポンス
 * ウマ娘の全冠達成に向けた育成ローテーションパターン一覧を返す
 */
export interface RacePatternResponse {
  /** 生成された育成パターンの配列 */
  patterns: RacePattern[];
  /** 対象ウマ娘名（任意） */
  umamusumeName?: string;
}

/**
 * `GET /races/remaining/:id/:season/:month/:half` のクエリパラメータ
 * 残レース一覧から出走登録画面へ遷移する際に渡す情報
 */
export interface RemainingToRaceProps {
  /** 育成期 (1: ジュニア, 2: クラシック, 3: シニア) */
  season: number;
  /** 月 (1〜12) */
  month: number;
  /** 前後半フラグ (false: 前半, true: 後半) */
  half: boolean;
  /** 戻り遷移かどうか（残レース一覧 → 出走登録 → 残レース一覧 の際に true） */
  isRaceReturn?: boolean;
  /** 前進遷移かどうか（出走登録 → 次のスロット に進む際に true） */
  isRaceForward?: boolean;
}

/**
 * `POST /auth/login` のリクエストボディ
 */
export interface LoginRequest {
  /** メールアドレス */
  email: string;
  /** パスワード */
  password: string;
}

/**
 * `POST /auth/signup` のリクエストボディ
 */
export interface SignUpRequest {
  /** メールアドレス */
  email: string;
  /** パスワード */
  password: string;
}

/**
 * `POST /auth/login` および `POST /auth/signup` のレスポンス
 */
export interface AuthResponse {
  /** 処理結果メッセージ */
  message: string;
  /** JWT アクセストークン（ログイン成功時のみ返却） */
  token?: string;
  /** リフレッシュトークン（ログイン成功時のみ返却） */
  refresh?: string;
}
