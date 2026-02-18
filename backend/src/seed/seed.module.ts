import { Module } from '@nestjs/common';
import { SeedService } from './seed.service.js';

/** 初期データ投入モジュール。アプリ起動時にマスタデータをDBへシードする */
@Module({
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
