import { TestBed } from '@angular/core/testing';
import { HttpRequest, HttpHandlerFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { authInterceptor } from '@core/interceptors/auth.interceptor';
import { AuthService } from '@core/services/auth.service';

/**
 * 対象: src/app/core/interceptors/auth.interceptor.ts
 *
 * AuthService.getToken() をモックし、Authorizationヘッダーの付与を検証する。
 */
describe('authInterceptor', () => {
  let mockAuthService: { getToken: ReturnType<typeof vi.fn> };

  function setupTestBed(token: string | null) {
    mockAuthService = { getToken: vi.fn().mockReturnValue(token) };

    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    });
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('トークンが存在する場合', () => {
    it('Authorization: Bearer <token> ヘッダーを付与してリクエストを渡す', () => {
      setupTestBed('my-jwt-token');

      const req = new HttpRequest('GET', '/api/test');
      let capturedReq: HttpRequest<unknown> | undefined;

      const next: HttpHandlerFn = (r) => {
        capturedReq = r as HttpRequest<unknown>;
        return of(new HttpResponse({ status: 200 }));
      };

      TestBed.runInInjectionContext(() => authInterceptor(req, next));

      expect(capturedReq).toBeDefined();
      expect(capturedReq!.headers.get('Authorization')).toBe('Bearer my-jwt-token');
    });

    it('元のリクエストは変更せず、クローンにヘッダーを付与する', () => {
      setupTestBed('some-token');

      const req = new HttpRequest('POST', '/api/data', { body: 'test' });

      const next: HttpHandlerFn = (r) => of(new HttpResponse({ status: 201 }));

      TestBed.runInInjectionContext(() => authInterceptor(req, next));

      // 元のリクエストにはヘッダーがないことを確認
      expect(req.headers.has('Authorization')).toBe(false);
    });
  });

  describe('トークンが null の場合', () => {
    it('Authorization ヘッダーを付与せず元のリクエストをそのまま渡す', () => {
      setupTestBed(null);

      const req = new HttpRequest('GET', '/api/public');
      let capturedReq: HttpRequest<unknown> | undefined;

      const next: HttpHandlerFn = (r) => {
        capturedReq = r as HttpRequest<unknown>;
        return of(new HttpResponse({ status: 200 }));
      };

      TestBed.runInInjectionContext(() => authInterceptor(req, next));

      expect(capturedReq).toBe(req);
      expect(capturedReq!.headers.has('Authorization')).toBe(false);
    });
  });

  describe('getToken の呼び出し', () => {
    it('リクエストごとに getToken を呼ぶ', () => {
      setupTestBed('token-value');

      const req = new HttpRequest('GET', '/api/test');
      const next: HttpHandlerFn = () => of(new HttpResponse({ status: 200 }));

      TestBed.runInInjectionContext(() => authInterceptor(req, next));

      expect(mockAuthService.getToken).toHaveBeenCalledTimes(1);
    });
  });
});
