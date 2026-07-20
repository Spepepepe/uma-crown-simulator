import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@uma-crown/shared';
import { Public } from '@common/decorators/public.decorator.js';

/** サーバーのヘルスチェックエンドポイントを提供するコントローラー */
@Controller('health')
export class HealthController {
  /**
   * サーバーの稼働状態を確認する
   * @returns ステータスオブジェクト
   */
  @Public() // 認証不要: ヘルスチェックはロードバランサー等から未認証で呼ばれる
  @Get()
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
