import { DatabaseException } from '@common/exceptions/database.exception';
import { ErrorCode } from '@common/constants/error-code.constant';

/**
 * 対象: src/common/exceptions/database.exception.ts
 *
 * コンストラクタ引数・デフォルト値・クラス識別プロパティを検証するユニットテスト。
 */
describe('DatabaseException', () => {
  describe('コンストラクタ', () => {
    it('引数がすべてプロパティに正しく設定される', () => {
      const cause = new Error('原因エラー');
      const err = new DatabaseException(
        'DB取得失敗',
        'RaceService.findAll',
        ErrorCode.DB_DATA_INTEGRITY,
        cause,
      );

      expect(err.message).toBe('DB取得失敗');
      expect(err.location).toBe('RaceService.findAll');
      expect(err.errorCode).toBe(ErrorCode.DB_DATA_INTEGRITY);
      expect(err.cause).toBe(cause);
    });

    it('cause を省略した場合は undefined になる', () => {
      const err = new DatabaseException('メッセージ', 'Service.method');

      expect(err.cause).toBeUndefined();
    });
  });

  describe('クラス識別プロパティ', () => {
    it('name が DatabaseException に設定される', () => {
      const err = new DatabaseException('msg', 'loc');

      expect(err.name).toBe('DatabaseException');
    });

    it('domain が database に設定される', () => {
      const err = new DatabaseException('msg', 'loc');

      expect(err.domain).toBe('database');
    });
  });

  describe('デフォルト値', () => {
    it('errorCode を省略した場合は DB_001 が使われる', () => {
      const err = new DatabaseException('msg', 'loc');

      expect(err.errorCode).toBe(ErrorCode.DB_QUERY_FAILED);
    });
  });

  describe('Error の継承', () => {
    it('instanceof Error が true になる', () => {
      expect(new DatabaseException('msg', 'loc')).toBeInstanceOf(Error);
    });
  });
});
