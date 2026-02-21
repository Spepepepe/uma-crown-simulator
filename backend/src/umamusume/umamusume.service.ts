import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service.js';

/** ウマ娘の登録・取得に関するビジネスロジックを提供するサービス */
@Injectable()
export class UmamusumeService {
  constructor(private readonly prisma: PrismaService) {}

  /** 全ウマ娘を取得
   * @returns ウマ娘一覧（ID昇順）
   */
  async findAll() {
    return this.prisma.umamusumeTable.findMany({
      orderBy: { umamusume_id: 'asc' },
    });
  }

  /** ユーザーが未登録のウマ娘を取得
   * @param userId - ユーザーID
   * @returns 未登録ウマ娘の一覧
   */
  async findUnregistered(userId: string) {
    const registered = await this.prisma.registUmamusumeTable.findMany({
      where: { user_id: userId },
      select: { umamusume_id: true },
    });
    const registeredIds = registered.map((r) => r.umamusume_id);

    return this.prisma.umamusumeTable.findMany({
      where: registeredIds.length > 0
        ? { umamusume_id: { notIn: registeredIds } }
        : undefined,
      orderBy: { umamusume_id: 'asc' },
    });
  }

  /** ユーザーの登録済みウマ娘を取得
   * @param userId - ユーザーID
   * @returns 登録済みウマ娘の一覧
   */
  async findRegistered(userId: string) {
    const rows = await this.prisma.registUmamusumeTable.findMany({
      where: { user_id: userId },
      include: { umamusume: true },
    });

    return rows.map((row) => ({
      umamusume: row.umamusume,
    }));
  }

  /** ウマ娘を登録
   * @param userId - ユーザーID
   * @param umamusumeId - 登録するウマ娘ID
   * @param raceIdArray - 初期出走済みとして登録するレースIDの配列
   * @returns 登録結果メッセージ
   */
  async register(
    userId: string,
    umamusumeId: number,
    raceIdArray: number[],
  ) {
    await this.prisma.registUmamusumeTable.create({
      data: {
        user_id: userId,
        umamusume_id: umamusumeId,
      },
    });

    if (raceIdArray.length > 0) {
      await this.prisma.registUmamusumeRaceTable.createMany({
        data: raceIdArray.map((raceId) => ({
          user_id: userId,
          umamusume_id: umamusumeId,
          race_id: raceId,
        })),
      });
    }

    return { message: 'ウマ娘を登録しました' };
  }

}
