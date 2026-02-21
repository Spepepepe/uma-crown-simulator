import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CognitoService } from '@common/cognito/cognito.service.js';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator.js';

/** CognitoJWTトークンを検証してリクエストを認可するガード */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly cognitoService: CognitoService,
    private readonly reflector: Reflector,
  ) {}

  /** ルートの認可を判定する。@Publicデコレーターが付いている場合はスキップする
   * @param context - 現在のリクエストの実行コンテキスト
   * @returns 認可が通った場合 true、失敗した場合は UnauthorizedException をスロー
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('認証トークンがありません');
    }

    const token = authHeader.slice(7);
    const userId = await this.cognitoService.verifyToken(token);

    if (!userId) {
      throw new UnauthorizedException('無効なトークンです');
    }

    request.userId = userId;
    return true;
  }
}
