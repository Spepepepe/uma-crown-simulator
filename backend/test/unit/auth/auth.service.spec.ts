import { AuthService } from '@src/auth/auth.service';
import type { AuthMeResponse } from '@uma-crown/shared';

/**
 * 対象: src/auth/auth.service.ts
 */
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
  });

  describe('getUserData', () => {
    it('AuthMeResponse 形式でユーザー情報を返す', () => {
      const result = service.getUserData('user-abc-123');
      const expected: AuthMeResponse = { userId: 'user-abc-123' };
      expect(result).toEqual(expected);
    });

    it('異なるユーザーIDでも正しく返す', () => {
      const result = service.getUserData('another-user');
      expect(result).toEqual({ userId: 'another-user' });
    });

    it('空文字のユーザーIDでも動作する', () => {
      const result = service.getUserData('');
      expect(result).toEqual({ userId: '' });
    });
  });
});
