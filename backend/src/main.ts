import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';

// BigInt → Number 変換 (Prisma が BIGINT カラムに BigInt を返すため)
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

/** アプリケーションのエントリポイント。NestJSアプリを起動する */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // リクエストボディの型変換・バリデーションをグローバル適用
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,      // DTO に定義されていないプロパティを自動除去
      transform: true,      // クエリパラメータ等を宣言型に自動変換
      forbidNonWhitelisted: false, // 不明プロパティは静かに除去（strict モードは API 互換性に影響するため無効）
    }),
  );
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:4200', 'http://127.0.0.1:4200'];
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
