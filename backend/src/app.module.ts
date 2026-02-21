import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { CognitoModule } from '@common/cognito/cognito.module.js';
import { PrismaModule } from '@common/prisma/prisma.module.js';
import { AuthGuard } from '@common/guards/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { UmamusumeModule } from './umamusume/umamusume.module.js';
import { RaceModule } from './race/race.module.js';
import { SeedModule } from './seed/seed.module.js';
import { HealthModule } from './health/health.module.js';
import { resolve } from 'path';

/** アプリケーション全体のルートモジュール。グローバルガード・設定・各機能モジュールを登録する */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(process.cwd(), '..', '.env'),
    }),
    CognitoModule, PrismaModule, AuthModule, UmamusumeModule, RaceModule, SeedModule, HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
