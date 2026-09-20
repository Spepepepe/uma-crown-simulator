import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap, catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '@ui/components/toast/toast.service';

/** HTTPリクエストに最新のCognito IDトークンをAuthorizationヘッダーとして付与するインターセプター。
 * IDトークンが期限切れの場合はリフレッシュトークンで自動更新する。
 * 401エラー時はセッション切れ通知を表示する。
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const toastService = inject(ToastService);

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
    catchError((error) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        toastService.showSessionExpired();
      }
      return throwError(() => error as Error);
    }),
  );
};
