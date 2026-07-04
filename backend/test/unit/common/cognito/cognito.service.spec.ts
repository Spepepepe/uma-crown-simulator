import { ConfigService } from '@nestjs/config';
import { CognitoService } from '@common/cognito/cognito.service';

/**
 * 対象: src/common/cognito/cognito.service.ts
 *
 * CognitoJwtVerifier をモック化し、トークン検証ロジックを検証するユニットテスト。
 */

const mockVerify = jest.fn();

jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({ verify: mockVerify })),
  },
}));

describe('CognitoService', () => {
  let service: CognitoService;
  let mockLogger: Record<string, jest.Mock>;
  let mockConfig: jest.Mocked<Pick<ConfigService, 'getOrThrow'>>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockConfig = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          COGNITO_USER_POOL_ID: 'ap-northeast-1_TestPool',
          COGNITO_CLIENT_ID: 'test-client-id',
        };
        return values[key];
      }),
    };

    service = new CognitoService(
      mockLogger as any,
      mockConfig as unknown as ConfigService,
    );
  });

  describe('コンストラクタ', () => {
    it('ConfigService から COGNITO_USER_POOL_ID と COGNITO_CLIENT_ID を取得する', () => {
      expect(mockConfig.getOrThrow).toHaveBeenCalledWith('COGNITO_USER_POOL_ID');
      expect(mockConfig.getOrThrow).toHaveBeenCalledWith('COGNITO_CLIENT_ID');
    });
  });

  describe('verifyToken', () => {
    it('有効なトークンの場合 → sub（ユーザーID）を返す', async () => {
      const expectedSub = 'cognito-user-sub-123';
      mockVerify.mockResolvedValue({ sub: expectedSub });

      const result = await service.verifyToken('valid-jwt-token');

      expect(result).toBe(expectedSub);
      expect(mockVerify).toHaveBeenCalledWith('valid-jwt-token');
    });

    it('無効なトークンの場合 → null を返す', async () => {
      mockVerify.mockRejectedValue(new Error('Invalid token'));

      const result = await service.verifyToken('invalid-token');

      expect(result).toBeNull();
    });

    it('無効なトークンの場合 → debug ログが出力される', async () => {
      const tokenError = new Error('Token expired');
      mockVerify.mockRejectedValue(tokenError);

      await service.verifyToken('expired-token');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        { err: tokenError },
        'トークン検証に失敗しました',
      );
    });
  });
});
