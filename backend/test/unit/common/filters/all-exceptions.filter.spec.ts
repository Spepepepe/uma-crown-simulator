import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from '@common/filters/all-exceptions.filter';
import { DatabaseException } from '@common/exceptions/database.exception';
import { ExternalApiException } from '@common/exceptions/external-api.exception';
import { BusinessLogicException } from '@common/exceptions/business-logic.exception';
import { ErrorCode } from '@common/constants/error-code.constant';

/**
 * 対象: src/common/filters/all-exceptions.filter.ts
 *
 * 例外種別ごとの HTTP レスポンス形式・ログレベルを検証するユニットテスト。
 */

/** ArgumentsHost モックを生成するヘルパー */
function makeHost(mockResponse: { status: jest.Mock }): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => mockResponse,
    }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockLogger: any;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockResponse: { status: jest.Mock };
  let host: ArgumentsHost;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    filter = new AllExceptionsFilter(mockLogger);

    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockResponse = { status: mockStatus };
    host = makeHost(mockResponse);
  });

  describe('HttpException（NestJS 組み込み例外）', () => {
    it('元のステータスコードで返す', () => {
      filter.catch(new HttpException('バリデーションエラー', HttpStatus.BAD_REQUEST), host);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    });

    it('body が string の場合 → errorCode は HTTP_ERROR になる', () => {
      filter.catch(new HttpException('バリデーションエラー', HttpStatus.BAD_REQUEST), host);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          errorCode: 'HTTP_ERROR',
          message: 'バリデーションエラー',
        }),
      );
    });

    it('body が object で errorCode を持つ場合 → errorCode がレスポンスに含まれる', () => {
      filter.catch(
        new HttpException(
          { errorCode: ErrorCode.VALIDATION_INVALID_INPUT, message: '入力値が不正です' },
          HttpStatus.BAD_REQUEST,
        ),
        host,
      );

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: ErrorCode.VALIDATION_INVALID_INPUT,
          message: '入力値が不正です',
        }),
      );
    });

    it('body が object で errorCode を持たない場合 → errorCode は HTTP_ERROR になる', () => {
      filter.catch(
        new HttpException({ message: '何らかのエラー' }, HttpStatus.BAD_REQUEST),
        host,
      );

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ errorCode: 'HTTP_ERROR' }),
      );
    });

    it('warn / error ログは出力しない', () => {
      filter.catch(new HttpException('エラー', HttpStatus.NOT_FOUND), host);

      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('body の message が string[] の場合 → "; " で結合した文字列で返す（ValidationPipe 対応）', () => {
      filter.catch(
        new HttpException(
          { message: ['必須項目です', '最大長を超えています'], statusCode: 400 },
          HttpStatus.BAD_REQUEST,
        ),
        host,
      );

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: '必須項目です; 最大長を超えています' }),
      );
    });
  });

  describe('BusinessLogicException（想定内ビジネスエラー）', () => {
    it('httpStatus で指定したステータスコードで返す', () => {
      const err = new BusinessLogicException(
        '既に登録済みです',
        'UmamusumeService.register',
        ErrorCode.CONFLICT_UMAMUSUME_ALREADY_REGISTERED,
        HttpStatus.CONFLICT,
      );
      filter.catch(err, host);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    });

    it('errorCode と message がレスポンスに含まれる', () => {
      const err = new BusinessLogicException(
        '既に登録済みです',
        'UmamusumeService.register',
        ErrorCode.CONFLICT_UMAMUSUME_ALREADY_REGISTERED,
        HttpStatus.CONFLICT,
      );
      filter.catch(err, host);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.CONFLICT,
          errorCode: ErrorCode.CONFLICT_UMAMUSUME_ALREADY_REGISTERED,
          message: '既に登録済みです',
        }),
      );
    });

    it('warn ログが出力される', () => {
      filter.catch(
        new BusinessLogicException('エラー', 'Service.method'),
        host,
      );

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('DatabaseException（DB エラー）', () => {
    it('500 で返す', () => {
      filter.catch(
        new DatabaseException('DB取得失敗', 'RaceService.findAll'),
        host,
      );

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('errorCode が DatabaseException のものになる', () => {
      filter.catch(
        new DatabaseException('DB取得失敗', 'RaceService.findAll', ErrorCode.DB_DATA_INTEGRITY),
        host,
      );

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ errorCode: ErrorCode.DB_DATA_INTEGRITY }),
      );
    });

    it('クライアントへのメッセージは固定文言になる', () => {
      filter.catch(
        new DatabaseException('内部詳細情報（漏洩させてはいけない）', 'Service.method'),
        host,
      );

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'サーバーエラーが発生しました' }),
      );
    });

    it('error ログが出力される', () => {
      filter.catch(
        new DatabaseException('DB取得失敗', 'RaceService.findAll'),
        host,
      );

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('ExternalApiException（外部 API エラー）', () => {
    it('500 で返す', () => {
      filter.catch(
        new ExternalApiException('API呼び出し失敗', 'ExternalService.fetch'),
        host,
      );

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('errorCode が ExternalApiException のものになる', () => {
      filter.catch(
        new ExternalApiException(
          'レスポンス形式不正',
          'ExternalService.fetch',
          ErrorCode.EXTERNAL_API_INVALID_RESPONSE,
        ),
        host,
      );

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ errorCode: ErrorCode.EXTERNAL_API_INVALID_RESPONSE }),
      );
    });

    it('error ログが出力される', () => {
      filter.catch(
        new ExternalApiException('API呼び出し失敗', 'ExternalService.fetch'),
        host,
      );

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('未知の例外（Error など）', () => {
    it('500 で返す', () => {
      filter.catch(new Error('予期しないエラー'), host);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('errorCode は INTERNAL_001 になる', () => {
      filter.catch(new Error('予期しないエラー'), host);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ errorCode: ErrorCode.INTERNAL_UNKNOWN }),
      );
    });

    it('クライアントへのメッセージは固定文言になる', () => {
      filter.catch(new Error('内部詳細情報'), host);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'サーバーエラーが発生しました' }),
      );
    });

    it('error ログが出力される', () => {
      filter.catch(new Error('予期しないエラー'), host);

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });
  });
});
