import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@common/constants/error-code.constant.js';

/**
 * ビジネスロジック上の想定内エラー（Operational Error）にスローするカスタム例外
 *
 * 担当: ビジネスルール違反情報（domain / location / errorCode / httpStatus）の保持
 * 禁止: ログ出力・HTTP 処理・DB アクセス
 *
 * AllExceptionsFilter が warn ログを出力し、httpStatus で指定したステータスを返す。
 */
export class BusinessLogicException extends Error {
  readonly domain = 'application' as const;

  constructor(
    message: string,
    /** 発生箇所（'ClassName.methodName' 形式） */
    readonly location: string,
    readonly errorCode: string = ErrorCode.INTERNAL_UNKNOWN,
    readonly httpStatus: number = HttpStatus.BAD_REQUEST,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'BusinessLogicException';
  }
}
