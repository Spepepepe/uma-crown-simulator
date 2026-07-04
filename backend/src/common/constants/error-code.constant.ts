/**
 * アプリケーション全体で使用するエラーコード定数
 *
 * 形式: CATEGORY_NNN
 * - VALIDATION: リクエストバリデーションエラー（400）
 * - AUTH: 認証・認可エラー（401/403）
 * - NOT_FOUND: リソース未存在（404）
 * - CONFLICT: 重複・競合（409）
 * - DB: DB 操作エラー（500）
 * - EXTERNAL: 外部 API エラー（500）
 * - INTERNAL: その他内部エラー（500）
 */
export const ErrorCode = {
  // バリデーション
  VALIDATION_INVALID_INPUT: 'VALIDATION_001',
  // リソース未存在
  NOT_FOUND_UMAMUSUME: 'NOT_FOUND_001',
  NOT_FOUND_RACE: 'NOT_FOUND_002',
  // 競合
  CONFLICT_UMAMUSUME_ALREADY_REGISTERED: 'CONFLICT_001',
  CONFLICT_RACE_ALREADY_RUN: 'CONFLICT_002',
  // DB
  DB_QUERY_FAILED: 'DB_001',
  DB_DATA_INTEGRITY: 'DB_002',
  // 外部 API
  EXTERNAL_API_FAILED: 'EXTERNAL_001',
  EXTERNAL_API_INVALID_RESPONSE: 'EXTERNAL_002',
  // 内部
  INTERNAL_UNKNOWN: 'INTERNAL_001',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
