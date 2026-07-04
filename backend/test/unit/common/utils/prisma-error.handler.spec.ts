import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { handlePrismaError } from '@common/utils/prisma-error.handler';
import { DatabaseException } from '@common/exceptions/database.exception';
import { ErrorCode } from '@common/constants/error-code.constant';

/**
 * 対象: src/common/utils/prisma-error.handler.ts
 *
 * Prisma エラーコード別の変換ロジックと、オプション引数の動作を検証するユニットテスト。
 */

/** 指定コードの PrismaClientKnownRequestError を生成するヘルパー */
function makeKnownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('テストエラー', {
    code,
    clientVersion: '6.0.0',
  });
}

describe('handlePrismaError', () => {
  describe('P2002（ユニーク制約違反）', () => {
    it('ConflictException をスローする', () => {
      expect(() => handlePrismaError(makeKnownError('P2002'), 'Service.method')).toThrow(
        ConflictException,
      );
    });

    it('デフォルトのエラーコードとメッセージが使われる', () => {
      expect(() => handlePrismaError(makeKnownError('P2002'), 'Service.method')).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            errorCode: ErrorCode.CONFLICT_UMAMUSUME_ALREADY_REGISTERED,
            message: '既に登録されています',
          }),
        }),
      );
    });

    it('options でエラーコードとメッセージをオーバーライドできる', () => {
      expect(() =>
        handlePrismaError(makeKnownError('P2002'), 'Service.method', {
          conflictErrorCode: ErrorCode.CONFLICT_RACE_ALREADY_RUN,
          conflictMessage: 'このレースは既に出走済みです',
        }),
      ).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            errorCode: ErrorCode.CONFLICT_RACE_ALREADY_RUN,
            message: 'このレースは既に出走済みです',
          }),
        }),
      );
    });
  });

  describe('P2025（レコード未存在）', () => {
    it('NotFoundException をスローする', () => {
      expect(() => handlePrismaError(makeKnownError('P2025'), 'Service.method')).toThrow(
        NotFoundException,
      );
    });

    it('デフォルトのエラーコードとメッセージが使われる', () => {
      expect(() => handlePrismaError(makeKnownError('P2025'), 'Service.method')).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            errorCode: ErrorCode.NOT_FOUND_UMAMUSUME,
            message: '指定されたデータが見つかりません',
          }),
        }),
      );
    });

    it('options でエラーコードとメッセージをオーバーライドできる', () => {
      expect(() =>
        handlePrismaError(makeKnownError('P2025'), 'Service.method', {
          notFoundErrorCode: ErrorCode.NOT_FOUND_RACE,
          notFoundMessage: '指定されたレースが見つかりません',
        }),
      ).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            errorCode: ErrorCode.NOT_FOUND_RACE,
            message: '指定されたレースが見つかりません',
          }),
        }),
      );
    });
  });

  describe('その他の PrismaClientKnownRequestError', () => {
    it('DatabaseException をスローする', () => {
      expect(() => handlePrismaError(makeKnownError('P2003'), 'Service.method')).toThrow(
        DatabaseException,
      );
    });

    it('DB_001 エラーコードで DatabaseException がスローされる', () => {
      expect(() => handlePrismaError(makeKnownError('P2003'), 'Service.method')).toThrow(
        expect.objectContaining({ errorCode: ErrorCode.DB_QUERY_FAILED }),
      );
    });
  });

  describe('Prisma 以外の一般エラー', () => {
    it('DatabaseException をスローする', () => {
      expect(() => handlePrismaError(new Error('予期しないエラー'), 'Service.method')).toThrow(
        DatabaseException,
      );
    });

    it('location が DatabaseException に設定される', () => {
      expect(() => handlePrismaError(new Error('エラー'), 'RaceService.findAll')).toThrow(
        expect.objectContaining({ location: 'RaceService.findAll' }),
      );
    });
  });

  describe('エッジケース', () => {
    it('null を渡した場合 → DatabaseException をスローする', () => {
      expect(() => handlePrismaError(null, 'Service.method')).toThrow(DatabaseException);
    });

    it('undefined を渡した場合 → DatabaseException をスローする', () => {
      expect(() => handlePrismaError(undefined, 'Service.method')).toThrow(DatabaseException);
    });

    it('null の cause が DatabaseException に設定される', () => {
      expect(() => handlePrismaError(null, 'Service.method')).toThrow(
        expect.objectContaining({ cause: null }),
      );
    });
  });
});
