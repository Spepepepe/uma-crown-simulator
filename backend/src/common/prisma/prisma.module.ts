import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/** PrismaServiceをグローバルに提供するモジュール */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
