import { ErrorCode } from '@common/constants/error-code.constant.js';

/**
 * 外部 API 呼び出し失敗時にスローするカスタム例外
 *
 * 担当: 外部 API エラー情報（domain / location / errorCode / cause）の保持
 * 禁止: ログ出力・HTTP 処理・ビジネスロジック
 */
export class ExternalApiException extends Error {
  readonly domain = 'external_api' as const;

  constructor(
    message: string,
    /** 発生箇所（'ClassName.methodName' 形式） */
    readonly location: string,
    readonly errorCode: string = ErrorCode.EXTERNAL_API_FAILED,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ExternalApiException';
  }
}
