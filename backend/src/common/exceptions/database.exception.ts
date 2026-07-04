import { ErrorCode } from '@common/constants/error-code.constant.js';

/**
 * DB 操作失敗時にスローするカスタム例外
 *
 * 担当: DB エラー情報（domain / location / errorCode / cause）の保持
 * 禁止: ログ出力・HTTP 処理・ビジネスロジック
 */
export class DatabaseException extends Error {
  readonly domain = 'database' as const;

  constructor(
    message: string,
    /** 発生箇所（'ClassName.methodName' 形式） */
    readonly location: string,
    readonly errorCode: string = ErrorCode.DB_QUERY_FAILED,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DatabaseException';
  }
}
