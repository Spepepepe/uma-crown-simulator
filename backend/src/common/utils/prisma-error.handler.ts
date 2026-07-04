import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseException } from '@common/exceptions/database.exception.js';
import { ErrorCode } from '@common/constants/error-code.constant.js';

/**
 * Prisma エラーを適切な HTTP 例外またはカスタム例外に変換してスローする
 *
 * 担当: Prisma エラーコードの判定と例外変換
 * 禁止: ログ出力・ビジネスロジック・DB アクセス
 *
 * @param err - キャッチした例外
 * @param location - 発生箇所（'ClassName.methodName' 形式）
 * @param options - エラーコード・メッセージのオーバーライド
 * @throws ConflictException P2002（ユニーク制約違反）の場合
 * @throws NotFoundException P2025（レコード未存在）の場合
 * @throws DatabaseException その他の Prisma エラーまたは予期しない例外の場合
 */
export function handlePrismaError(
  err: unknown,
  location: string,
  options?: {
    conflictErrorCode?: string;
    notFoundErrorCode?: string;
    conflictMessage?: string;
    notFoundMessage?: string;
  },
): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': // ユニーク制約違反
        throw new ConflictException({
          errorCode: options?.conflictErrorCode ?? ErrorCode.CONFLICT_UMAMUSUME_ALREADY_REGISTERED,
          message: options?.conflictMessage ?? '既に登録されています',
        });
      case 'P2025': // レコード未存在
        throw new NotFoundException({
          errorCode: options?.notFoundErrorCode ?? ErrorCode.NOT_FOUND_UMAMUSUME,
          message: options?.notFoundMessage ?? '指定されたデータが見つかりません',
        });
    }
  }
  throw new DatabaseException('DB 操作に失敗しました', location, ErrorCode.DB_QUERY_FAILED, err);
}
