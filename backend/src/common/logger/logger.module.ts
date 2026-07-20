import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'node:http';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>('NODE_ENV') === 'production';
        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            timestamp: () => `,"time":"${new Date().toISOString()}"`,
            // ヘルスチェックエンドポイントへのリクエストはログ出力しない
            autoLogging: {
              ignore: (req: IncomingMessage) => req.url === '/api/v1/health',
            },
            // req/res のログ出力フィールドを必要最小限に絞る
            // デフォルトではヘッダー全体（Authorizationトークン含む）・remotePort等が出力されるため
            serializers: {
              req: (req: IncomingMessage) => ({
                method: req.method,
                url: req.url,
              }),
              res: (res: ServerResponse) => ({
                statusCode: res.statusCode,
              }),
            },
            transport: !isProduction
              ? { target: 'pino-pretty', options: { colorize: true } }
              : undefined,
          },
        };
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
