import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

/**
 * アプリケーション全体の例外をキャッチするグローバルフィルター
 *
 * - `HttpException` はそのままステータスコードとメッセージを返す
 * - Prisma エラーなど予期せぬ例外は 500 としてクライアントに返し、
 *   スタックトレースなどの内部情報は漏洩させない
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

    let status: number;
    let message: string | string[];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        const body = exceptionResponse as Record<string, unknown>;
        message = (body['message'] as string | string[]) ?? exception.message;
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'サーバーエラーが発生しました';
      this.logger.error({ err: exception }, '未ハンドルの例外が発生しました');
    }

    response.status(status).json({
      statusCode: status,
      message,
    });
  }
}
