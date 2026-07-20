import { HttpStatus } from '@nestjs/common';
import { BusinessLogicException } from '@common/exceptions/business-logic.exception';
import { ErrorCode } from '@common/constants/error-code.constant';

/**
 * 対象: src/common/exceptions/business-logic.exception.ts
 *
 * コンストラクタ引数・デフォルト値・クラス識別プロパティを検証するユニットテスト。
 */
describe('BusinessLogicException', () => {
  describe('コンストラクタ', () => {
    it('引数がすべてプロパティに正しく設定される', () => {
      const cause = new Error('原因');
      const err = new BusinessLogicException(
        'ビジネスルール違反',
        'UmamusumeService.register',
        ErrorCode.CONFLICT_UMAMUSUME_ALREADY_REGISTERED,
        HttpStatus.CONFLICT,
        cause,
      );

      expect(err.message).toBe('ビジネスルール違反');
      expect(err.location).toBe('UmamusumeService.register');
      expect(err.errorCode).toBe(
        ErrorCode.CONFLICT_UMAMUSUME_ALREADY_REGISTERED,
      );
      expect(err.httpStatus).toBe(HttpStatus.CONFLICT);
      expect(err.cause).toBe(cause);
    });

    it('cause を省略した場合は undefined になる', () => {
      const err = new BusinessLogicException('msg', 'loc');

      expect(err.cause).toBeUndefined();
    });
  });

  describe('クラス識別プロパティ', () => {
    it('name が BusinessLogicException に設定される', () => {
      const err = new BusinessLogicException('msg', 'loc');

      expect(err.name).toBe('BusinessLogicException');
    });

    it('domain が application に設定される', () => {
      const err = new BusinessLogicException('msg', 'loc');

      expect(err.domain).toBe('application');
    });
  });

  describe('デフォルト値', () => {
    it('errorCode を省略した場合は INTERNAL_001 が使われる', () => {
      const err = new BusinessLogicException('msg', 'loc');

      expect(err.errorCode).toBe(ErrorCode.INTERNAL_UNKNOWN);
    });

    it('httpStatus を省略した場合は 400（BAD_REQUEST）が使われる', () => {
      const err = new BusinessLogicException('msg', 'loc');

      expect(err.httpStatus).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Error の継承', () => {
    it('instanceof Error が true になる', () => {
      expect(new BusinessLogicException('msg', 'loc')).toBeInstanceOf(Error);
    });
  });
});
