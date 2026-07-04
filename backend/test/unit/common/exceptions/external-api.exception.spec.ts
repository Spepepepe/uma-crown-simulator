import { ExternalApiException } from '@common/exceptions/external-api.exception';
import { ErrorCode } from '@common/constants/error-code.constant';

/**
 * 対象: src/common/exceptions/external-api.exception.ts
 *
 * コンストラクタ引数・デフォルト値・クラス識別プロパティを検証するユニットテスト。
 */
describe('ExternalApiException', () => {
  describe('コンストラクタ', () => {
    it('引数がすべてプロパティに正しく設定される', () => {
      const cause = new Error('タイムアウト');
      const err = new ExternalApiException(
        '外部API接続失敗',
        'ExternalService.fetch',
        ErrorCode.EXTERNAL_API_INVALID_RESPONSE,
        cause,
      );

      expect(err.message).toBe('外部API接続失敗');
      expect(err.location).toBe('ExternalService.fetch');
      expect(err.errorCode).toBe(ErrorCode.EXTERNAL_API_INVALID_RESPONSE);
      expect(err.cause).toBe(cause);
    });

    it('cause を省略した場合は undefined になる', () => {
      const err = new ExternalApiException('メッセージ', 'Service.method');

      expect(err.cause).toBeUndefined();
    });
  });

  describe('クラス識別プロパティ', () => {
    it('name が ExternalApiException に設定される', () => {
      const err = new ExternalApiException('msg', 'loc');

      expect(err.name).toBe('ExternalApiException');
    });

    it('domain が external_api に設定される', () => {
      const err = new ExternalApiException('msg', 'loc');

      expect(err.domain).toBe('external_api');
    });
  });

  describe('デフォルト値', () => {
    it('errorCode を省略した場合は EXTERNAL_001 が使われる', () => {
      const err = new ExternalApiException('msg', 'loc');

      expect(err.errorCode).toBe(ErrorCode.EXTERNAL_API_FAILED);
    });
  });

  describe('Error の継承', () => {
    it('instanceof Error が true になる', () => {
      expect(new ExternalApiException('msg', 'loc')).toBeInstanceOf(Error);
    });
  });
});
