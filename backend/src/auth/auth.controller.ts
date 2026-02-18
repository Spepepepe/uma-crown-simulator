import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

/** 認証関連のエンドポイントを提供するコントローラー */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 認証済みユーザー自身のデータを取得する (GET /auth/me)
   * @param userId - JWTトークンから取得したユーザーID
   * @returns ユーザーIDを含むオブジェクト
   */
  @Get('me')
  getUserData(@CurrentUser() userId: string) {
    return this.authService.getUserData(userId);
  }
}
