import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../../../../src/common/guards/auth.guard';
import { CognitoService } from '../../../../src/common/cognito/cognito.service';

/**
 * 対象: src/common/guards/auth.guard.ts
 */

/** ExecutionContextのモックを生成するヘルパー */
function makeContext(headers: Record<string, string> = {}): ExecutionContext {
  const request = { headers, userId: undefined as string | undefined };
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(request),
    }),
    _request: request,
  } as any;
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let mockReflector: jest.Mocked<Reflector>;
  let mockCognitoService: jest.Mocked<CognitoService>;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    mockCognitoService = {
      verifyToken: jest.fn(),
    } as any;

    guard = new AuthGuard(mockCognitoService, mockReflector);
  });

  describe('@Publicデコレーターが付いているルート', () => {
    it('認証ヘッダーなしでも true を返す', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);
      const ctx = makeContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockCognitoService.verifyToken).not.toHaveBeenCalled();
    });
  });

  describe('認証が必要なルート', () => {
    beforeEach(() => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
    });

    it('Authorizationヘッダーがない場合 → UnauthorizedException をスローする', async () => {
      const ctx = makeContext({});

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(ctx)).rejects.toThrow('認証トークンがありません');
    });

    it('"Bearer "で始まらないAuthorizationヘッダーの場合 → UnauthorizedException をスローする', async () => {
      const ctx = makeContext({ authorization: 'Basic some-token' });

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('CognitoのverifyTokenがnullを返す場合 → UnauthorizedException をスローする', async () => {
      mockCognitoService.verifyToken.mockResolvedValue(null as any);
      const ctx = makeContext({ authorization: 'Bearer invalid-token' });

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(ctx)).rejects.toThrow('無効なトークンです');
    });

    it('有効なトークンの場合 → trueを返し、request.userIdにユーザーIDをセットする', async () => {
      const expectedUserId = 'cognito-user-id-abc';
      mockCognitoService.verifyToken.mockResolvedValue(expectedUserId);

      const ctx = makeContext({ authorization: 'Bearer valid-jwt-token' });
      const request = ctx.switchToHttp().getRequest();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockCognitoService.verifyToken).toHaveBeenCalledWith('valid-jwt-token');
      expect(request.userId).toBe(expectedUserId);
    });
  });
});
