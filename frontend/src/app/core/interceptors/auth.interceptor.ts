import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** HTTPリクエストに最新のCognito IDトークンをAuthorizationヘッダーとして付与するインターセプター。
 * IDトークンが期限切れの場合はリフレッシュトークンで自動更新する。
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return from(authService.getFreshToken()).pipe(
    switchMap((token) => {
      if (token) {
        const cloned = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        });
        return next(cloned);
      }
      return next(req);
    }),
  );
};
