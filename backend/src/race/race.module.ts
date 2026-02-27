import { Module } from '@nestjs/common';
import { RaceController } from './race.controller.js';
import { RaceService } from './race.service.js';
import { RacePatternService } from './pattern/race-pattern.service.js';

/** レース機能モジュール。レース一覧・残レース管理・パターン提案などの機能を提供する */
@Module({
  controllers: [RaceController],
  providers: [RaceService, RacePatternService],
})
export class RaceModule {}
