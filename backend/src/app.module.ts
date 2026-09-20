import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import Joi from 'joi';
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
 * - ConfigModule: .env をグローバル参照（Joi スキーマで起動時バリデーション）
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(process.cwd(), '..', '.env'),
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        COGNITO_USER_POOL_ID: Joi.string().required(),
        COGNITO_CLIENT_ID: Joi.string().required(),
        CORS_ORIGIN: Joi.string().default(
          'http://localhost:4200,http://127.0.0.1:4200',
        ),
        PORT: Joi.number().default(3000),
        NODE_ENV: Joi.string()
          .valid('development', 'production')
          .default('development'),
      }),
    }),
    LoggerModule,
    CognitoModule,
    PrismaModule,
    AuthModule,
    UmamusumeModule,
    RaceModule,
    SeedModule,
    HealthModule,
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
