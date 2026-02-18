import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** PrismaClientをNestJSのライフサイクルに統合するサービス */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /** モジュール初期化時にデータベース接続を確立する */
  async onModuleInit() {
    await this.$connect();
  }

  /** モジュール破棄時にデータベース接続を切断する */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
