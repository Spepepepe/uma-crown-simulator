import { Controller, Get } from '@nestjs/common';
import type { AuthMeResponse } from '@uma-crown/shared';
import { AuthService } from './auth.service.js';
import { CurrentUser } from '@common/decorators/current-user.decorator.js';

/** 認証関連のエンドポイントを提供するコントローラー */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 認証済みユーザー自身のデータを取得する (GET /auth/me)
   * @param userId - JWT トークンから取得したユーザー ID
   * @returns 認証済みユーザー情報
   */
  @Get('me')
  getUserData(@CurrentUser() userId: string): AuthMeResponse {
    return this.authService.getUserData(userId);
  }
}
