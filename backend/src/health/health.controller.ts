import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';

/** サーバーのヘルスチェックエンドポイントを提供するコントローラー */
@Controller('health')
export class HealthController {
  /** サーバーの稼働状態を確認する (GET /health) ※認証不要
   * @returns ステータスオブジェクト
   */
  @Public()
  @Get()
  check() {
    return { status: 'ok' };
  }
}
