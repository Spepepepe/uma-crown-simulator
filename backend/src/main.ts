import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';

// BigInt → Number 変換 (Prisma が BIGINT カラムに BigInt を返すため)
Object.defineProperty(BigInt.prototype, 'toJSON', {
  value: function (this: bigint) {
    return Number(this);
  },
  writable: true,
  configurable: true,
});

/** アプリケーションのエントリポイント。NestJSアプリを起動する */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService);
  // リクエストボディの型変換・バリデーションをグローバル適用
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO に定義されていないプロパティを自動除去
      forbidNonWhitelisted: true, // 余分フィールドを 400 エラーにする
      transform: true, // クエリパラメータ等を宣言型に自動変換
    }),
  );
  const corsOriginRaw = config.get<string>('CORS_ORIGIN');
  const corsOrigin = corsOriginRaw
    ? corsOriginRaw.split(',')
    : ['http://localhost:4200', 'http://127.0.0.1:4200'];
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  await app.listen(config.get<number>('PORT') ?? 3000);
}
void bootstrap();
