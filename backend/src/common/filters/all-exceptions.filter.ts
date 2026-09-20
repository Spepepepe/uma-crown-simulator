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
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      this.handleHttpException(exception, response);
      return;
    }

    if (exception instanceof BusinessLogicException) {
      this.handleBusinessLogicException(exception, response);
      return;
    }

    this.handleUnexpectedException(exception, response);
  }

  /** HttpException を処理する */
  private handleHttpException(
    exception: HttpException,
    response: Response,
  ): void {
    const status = exception.getStatus();
    const body = exception.getResponse();
    const message = this.extractMessage(body, exception.message);
    const errorCode = this.extractErrorCode(body);
    response.status(status).json({ statusCode: status, errorCode, message });
  }

  /** BusinessLogicException を処理する */
  private handleBusinessLogicException(
    exception: BusinessLogicException,
    response: Response,
  ): void {
    this.logger.warn(
      { domain: exception.domain, location: exception.location },
      `[${exception.domain}] ${exception.location}: ${exception.message}`,
    );
    response.status(exception.httpStatus).json({
      statusCode: exception.httpStatus,
      errorCode: exception.errorCode,
      message: exception.message,
    });
  }

  /** 未ハンドルの例外を処理する */
  private handleUnexpectedException(
    exception: unknown,
    response: Response,
  ): void {
    const { domain, location, errorCode } =
      this.extractExceptionInfo(exception);

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

  /** HttpException のレスポンスボディからメッセージを抽出する */
  private extractMessage(body: string | object, fallback: string): string {
    if (typeof body === 'string') return body;
    const rawMessage = (body as Record<string, unknown>)['message'];
    if (Array.isArray(rawMessage)) return (rawMessage as string[]).join('; ');
    return (rawMessage as string) ?? fallback;
  }

  /** HttpException のレスポンスボディから errorCode を抽出する */
  private extractErrorCode(body: string | object): string {
    if (typeof body !== 'object') return 'HTTP_ERROR';
    return (
      ((body as Record<string, unknown>)['errorCode'] as string) ?? 'HTTP_ERROR'
    );
  }

  /** DatabaseException / ExternalApiException から domain / location / errorCode を抽出する */
  private extractExceptionInfo(exception: unknown): {
    domain: string;
    location: string;
    errorCode: string;
  } {
    if (exception instanceof DatabaseException) {
      return {
        domain: exception.domain,
        location: exception.location,
        errorCode: exception.errorCode,
      };
    }
    if (exception instanceof ExternalApiException) {
      return {
        domain: exception.domain,
        location: exception.location,
        errorCode: exception.errorCode,
      };
    }
    return {
      domain: 'application',
      location: '不明',
      errorCode: ErrorCode.INTERNAL_UNKNOWN,
    };
  }
}
