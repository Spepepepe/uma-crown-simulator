import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service.js';
import { handlePrismaError } from '@common/utils/prisma-error.handler.js';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { UmamusumeResponse, RegisteredUmamusumeResponse } from '@uma-crown/shared';
import { toUmamusumeResponse, toRegisteredUmamusumeResponse } from './umamusume.mapper.js';

/** ウマ娘の登録・取得に関するビジネスロジックを提供するサービス */
@Injectable()
export class UmamusumeService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(UmamusumeService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * 全ウマ娘を取得する
   * @returns ウマ娘一覧（ID昇順）
   * @throws DatabaseException DB取得失敗時
   */
  async findAll(): Promise<UmamusumeResponse[]> {
    let rows;
    try {
      rows = await this.prisma.umamusumeTable.findMany({
        orderBy: { umamusume_id: 'asc' },
      });
    } catch (err) {
      handlePrismaError(err, 'UmamusumeService.findAll');
    }
    return rows.map(toUmamusumeResponse);
  }

  /**
   * ユーザーが未登録のウマ娘を取得する
   * @param userId - ユーザーID
   * @returns 未登録ウマ娘の一覧
   * @throws DatabaseException DB取得失敗時
   */
  async findUnregistered(userId: string): Promise<UmamusumeResponse[]> {
    let registered;
    try {
      registered = await this.prisma.registUmamusumeTable.findMany({
        where: { user_id: userId },
        select: { umamusume_id: true },
      });
    } catch (err) {
      handlePrismaError(err, 'UmamusumeService.findUnregistered');
    }
    const registeredIds = registered.map((r) => r.umamusume_id);

    let rows;
    try {
      rows = await this.prisma.umamusumeTable.findMany({
        where: { umamusume_id: { notIn: registeredIds } },
        orderBy: { umamusume_id: 'asc' },
      });
    } catch (err) {
      handlePrismaError(err, 'UmamusumeService.findUnregistered');
    }
    return rows.map(toUmamusumeResponse);
  }

  /**
   * ユーザーの登録済みウマ娘を取得する
   * @param userId - ユーザーID
   * @returns 登録済みウマ娘の一覧
   * @throws DatabaseException DB取得失敗時
   */
  async findRegistered(userId: string): Promise<RegisteredUmamusumeResponse[]> {
    let rows;
    try {
      rows = await this.prisma.registUmamusumeTable.findMany({
        where: { user_id: userId },
        include: { umamusume: true },
      });
    } catch (err) {
      handlePrismaError(err, 'UmamusumeService.findRegistered');
    }
    return rows.map(toRegisteredUmamusumeResponse);
  }

  /**
   * 登録済みウマ娘を削除する（出走済みレースも合わせて削除）
   * @param userId - ユーザーID
   * @param umamusumeId - 削除するウマ娘ID
   * @throws DatabaseException DB操作失敗時
   */
  async unregister(userId: string, umamusumeId: number): Promise<void> {
    try {
      await this.prisma.$transaction([
        this.prisma.registUmamusumeRaceTable.deleteMany({
          where: { user_id: userId, umamusume_id: umamusumeId },
        }),
        this.prisma.registUmamusumeTable.deleteMany({
          where: { user_id: userId, umamusume_id: umamusumeId },
        }),
      ]);
    } catch (err) {
      handlePrismaError(err, 'UmamusumeService.unregister');
    }
    this.logger.info({ userId, umamusumeId }, 'ウマ娘の登録を解除しました');
  }

  /**
   * ウマ娘を登録する
   * @param userId - ユーザーID
   * @param umamusumeId - 登録するウマ娘ID
   * @param raceIdArray - 初期出走済みとして登録するレースIDの配列
   * @returns 登録されたウマ娘情報
   * @throws DatabaseException DB操作失敗時
   */
  async register(
    userId: string,
    umamusumeId: number,
    raceIdArray: number[],
  ): Promise<UmamusumeResponse> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.registUmamusumeTable.create({
          data: {
            user_id: userId,
            umamusume_id: umamusumeId,
          },
        });

        if (raceIdArray.length > 0) {
          await tx.registUmamusumeRaceTable.createMany({
            data: raceIdArray.map((raceId) => ({
              user_id: userId,
              umamusume_id: umamusumeId,
              race_id: raceId,
            })),
          });
        }
      });
    } catch (err) {
      handlePrismaError(err, 'UmamusumeService.register', {
        conflictMessage: '既に登録済みのウマ娘です',
      });
    }

    this.logger.info({ userId, umamusumeId, initialRaceCount: raceIdArray.length }, 'ウマ娘を登録しました');

    let row;
    try {
      row = await this.prisma.umamusumeTable.findUniqueOrThrow({
        where: { umamusume_id: umamusumeId },
      });
    } catch (err) {
      handlePrismaError(err, 'UmamusumeService.register');
    }
    return toUmamusumeResponse(row);
  }
}
