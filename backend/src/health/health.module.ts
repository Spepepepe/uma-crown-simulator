import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

/** ヘルスチェックエンドポイントを提供するモジュール */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
