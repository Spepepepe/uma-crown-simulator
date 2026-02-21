import { AuthService } from '@src/auth/auth.service';

/**
 * 対象: src/auth/auth.service.ts
 */
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
  });

  describe('getUserData', () => {
    it('ユーザーIDを含むオブジェクトを返す', () => {
      const result = service.getUserData('user-abc-123');
      expect(result).toEqual({ user_id: 'user-abc-123' });
    });

    it('異なるユーザーIDでも正しく返す', () => {
      const result = service.getUserData('another-user');
      expect(result).toEqual({ user_id: 'another-user' });
    });

    it('空文字のユーザーIDでも動作する', () => {
      const result = service.getUserData('');
      expect(result).toEqual({ user_id: '' });
    });
  });
});
