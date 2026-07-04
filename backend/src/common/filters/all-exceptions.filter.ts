import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DatabaseException } from '@common/exceptions/database.exception.js';
import { ExternalApiException } from '@common/exceptions/external-api.exception.js';
import { BusinessLogicException } from '@common/exceptions/business-logic.exception.js';
import { ErrorCode } from '@common/constants/error-code.constant.js';

/**
 * アプリケーション全体の例外をキャッチするグローバルフィルター
 *
 * 担当: 例外の種別判定・統一フォーマット（statusCode / errorCode / message）での返却・ログ出力
 * 禁止: ビジネスロジック・DB アクセス
 *
 * 処理フロー:
 * 1. HttpException（ValidationPipe / NotFoundException 等）→ そのままステータス・errorCode を返す
 * 2. BusinessLogicException（想定内ビジネスエラー）→ warn ログ + httpStatus で返す
 * 3. DatabaseException / ExternalApiException / その他 → error ログ + 500 で返す
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(AllExceptionsFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * 例外をキャッチし、統一フォーマットの JSON レスポンスを返す
   * @param exception - キャッチした例外
   * @param host - ArgumentsHost（HTTP コンテキストへのアクセスに使用）
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Operational Error（HttpException: ValidationPipe / NestJS 組み込み例外）
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const rawMessage =
        typeof body === 'string' ? body : (body as Record<string, unknown>)['message'];
      const message = Array.isArray(rawMessage)
        ? (rawMessage as string[]).join('; ')
        : ((rawMessage as string) ?? exception.message);
      const errorCode =
        typeof body === 'object'
          ? ((body as Record<string, unknown>)['errorCode'] as string) ?? 'HTTP_ERROR'
          : 'HTTP_ERROR';
      response.status(status).json({ statusCode: status, errorCode, message });
      return;
    }

    // Operational Error（BusinessLogicException: ビジネスルール違反）
    if (exception instanceof BusinessLogicException) {
      this.logger.warn(
        { domain: exception.domain, location: exception.location },
        `[${exception.domain}] ${exception.location}: ${exception.message}`,
      );
      response.status(exception.httpStatus).json({
        statusCode: exception.httpStatus,
        errorCode: exception.errorCode,
        message: exception.message,
      });
      return;
    }

    // Programmer Error（DatabaseException / ExternalApiException / その他予期しない例外）
    const domain =
      exception instanceof DatabaseException ? exception.domain
      : exception instanceof ExternalApiException ? exception.domain
      : 'application';

    const location =
      exception instanceof DatabaseException || exception instanceof ExternalApiException
        ? exception.location
        : '不明';

    const errorCode =
      exception instanceof DatabaseException ? exception.errorCode
      : exception instanceof ExternalApiException ? exception.errorCode
      : ErrorCode.INTERNAL_UNKNOWN;

    this.logger.error(
      { err: exception, domain, location },
      `[${domain}] ${location} で未ハンドルの例外が発生しました`,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode,
      message: 'サーバーエラーが発生しました',
    });
  }
}
