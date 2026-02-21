import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { authGuard } from '@core/guards/auth.guard';
import { AuthService } from '@core/services/auth.service';

/**
 * 対象: src/app/core/guards/auth.guard.ts
 *
 * AuthService をモックし、ログイン状態によるルート制御を検証する。
 */
describe('authGuard', () => {
  let mockAuthService: { isLoggedIn: ReturnType<typeof signal<boolean>> };
  let router: Router;

  function setupTestBed(isLoggedIn: boolean) {
    mockAuthService = { isLoggedIn: signal(isLoggedIn) };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
      ],
    });

    router = TestBed.inject(Router);
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('ログイン済みの場合', () => {
    it('true を返す（ルートへのアクセスを許可）', () => {
      setupTestBed(true);

      const result = TestBed.runInInjectionContext(() =>
        authGuard({} as any, {} as any),
      );

      expect(result).toBe(true);
    });
  });

  describe('未ログインの場合', () => {
    it('UrlTree を返す（リダイレクト）', () => {
      setupTestBed(false);

      const result = TestBed.runInInjectionContext(() =>
        authGuard({} as any, {} as any),
      );

      expect(result).toBeInstanceOf(UrlTree);
    });

    it('/login へのリダイレクト UrlTree を返す', () => {
      setupTestBed(false);

      const result = TestBed.runInInjectionContext(() =>
        authGuard({} as any, {} as any),
      ) as UrlTree;

      // router.createUrlTree(['/login']) と同じ UrlTree であること
      const expected = router.createUrlTree(['/login']);
      expect(result.toString()).toBe(expected.toString());
    });
  });
});
