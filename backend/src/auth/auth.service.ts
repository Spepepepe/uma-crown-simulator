import { Injectable } from '@nestjs/common';
import type { AuthMeResponse } from '@uma-crown/shared';

/** 認証関連のビジネスロジックを提供するサービス */
@Injectable()
export class AuthService {
  /**
   * 認証済みユーザーのデータを返す
   * @param userId - Cognito ユーザー ID
   * @returns 認証済みユーザー情報
   */
  getUserData(userId: string): AuthMeResponse {
    return { userId };
  }
}
