import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { NavigationService } from '../../../core/services/navigation.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="fixed inset-0 flex items-center justify-center bg-cover bg-center bg-no-repeat"
         style="background-image: url('/image/backgroundFile/login-bg.png')">
      <div class="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-8 w-full max-w-md">
        <h1 class="text-2xl font-bold text-center text-gray-800 mb-6">ログイン</h1>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input
              type="email"
              [(ngModel)]="email"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              type="password"
              [(ngModel)]="password"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="パスワードを入力"
            />
          </div>

          @if (errorMessage()) {
            <p class="text-red-500 text-sm">{{ errorMessage() }}</p>
          }

          <button
            (click)="onLogin()"
            [disabled]="loading()"
            class="w-full py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition disabled:opacity-50 cursor-pointer"
          >
            {{ loading() ? 'ログイン中...' : 'ログイン' }}
          </button>

          <div class="text-center mt-4">
            <button
              (click)="navService.navigate({ page: 'register' })"
              class="text-blue-500 hover:underline text-sm cursor-pointer"
            >
              新規登録
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
/** ログイン画面コンポーネント */
export class LoginComponent {
  private readonly authService = inject(AuthService);
  protected readonly navService = inject(NavigationService);

  /** メールアドレス入力値 */
  email = '';
  /** パスワード入力値 */
  password = '';
  /** ログイン処理中フラグ */
  loading = signal(false);
  /** エラーメッセージ */
  errorMessage = signal('');

  /** ログインボタンクリック時の処理 */
  async onLogin() {
    if (!this.email || !this.password) {
      this.errorMessage.set('メールアドレスとパスワードを入力してください');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    const result = await this.authService.login(this.email, this.password);

    if (result.success) {
      this.navService.navigate({ page: 'character-regist' });
    } else {
      this.errorMessage.set(result.error ?? 'ログインに失敗しました');
    }

    this.loading.set(false);
  }
}
