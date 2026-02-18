import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

// BigInt → Number 変換 (Prisma が BIGINT カラムに BigInt を返すため)
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

/** アプリケーションのエントリポイント。NestJSアプリを起動する */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
