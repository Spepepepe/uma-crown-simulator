import { Module } from '@nestjs/common';
import { UmamusumeController } from './umamusume.controller.js';
import { UmamusumeService } from './umamusume.service.js';

/** ウマ娘機能モジュール。登録・一覧取得などの機能を提供する */
@Module({
  controllers: [UmamusumeController],
  providers: [UmamusumeService],
  exports: [UmamusumeService],
})
export class UmamusumeModule {}
