import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './shared/components/sidebar/sidebar';
import { ToastComponent } from './shared/components/toast/toast';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, ToastComponent],
  template: `
    <app-toast />
    <div class="flex min-h-screen">
      @if (authService.isLoggedIn()) {
        <app-sidebar />
      }
      <main class="flex-1 overflow-auto">
        <router-outlet />
      </main>
    </div>
  `,
})
/** アプリケーションのルートコンポーネント。ログイン状態に応じてサイドバーを表示する */
export class App {
  /** 認証状態の参照に使用するAuthService */
  protected readonly authService = inject(AuthService);
}
