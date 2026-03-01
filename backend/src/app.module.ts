import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { CognitoModule } from '@common/cognito/cognito.module.js';
import { PrismaModule } from '@common/prisma/prisma.module.js';
import { AuthGuard } from '@common/guards/auth.guard.js';
import { AllExceptionsFilter } from '@common/filters/all-exceptions.filter.js';
import { AuthModule } from './auth/auth.module.js';
import { UmamusumeModule } from './umamusume/umamusume.module.js';
import { RaceModule } from './race/race.module.js';
import { SeedModule } from './seed/seed.module.js';
import { HealthModule } from './health/health.module.js';
import { LoggerModule } from '@common/logger/logger.module.js';
import { resolve } from 'path';

/**
 * アプリケーション全体のルートモジュール
 *
 * - グローバル ExceptionFilter（AllExceptionsFilter）: Prisma エラー等の未処理例外を一元ハンドリング
 * - グローバル AuthGuard: 全エンドポイントで Cognito JWT を検証（@Public() で除外可）
 * - ConfigModule: .env をグローバル参照
 */
@Module({
  imports: [
    LoggerModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(process.cwd(), '..', '.env'),
    }),
    CognitoModule, PrismaModule, AuthModule, UmamusumeModule, RaceModule, SeedModule, HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
