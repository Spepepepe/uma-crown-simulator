import { Injectable } from '@nestjs/common';

/** 認証関連のビジネスロジックを提供するサービス */
@Injectable()
export class AuthService {
  /** 認証済みユーザーのデータを返す
   * @param userId - CognitoユーザーID
   * @returns ユーザーIDを含むオブジェクト
   */
  getUserData(userId: string) {
    return { user_id: userId };
  }
}
