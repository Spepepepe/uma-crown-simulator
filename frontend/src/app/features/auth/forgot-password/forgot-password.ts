import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { NavigationService } from '@core/services/navigation.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat"
         style="background-image: url('/image/backgroundFile/login-bg.png')">
      <div class="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-8 w-full max-w-md overflow-y-auto max-h-[90vh]">

        @if (!showReset()) {
          <!-- Step 1: メールアドレス入力 -->
          <h1 class="text-2xl font-bold text-center text-gray-800 mb-2">パスワードをお忘れの方</h1>
          <p class="text-sm text-gray-600 text-center mb-6">
            登録済みのメールアドレスを入力してください。<br />パスワードリセット用のコードを送信します。
          </p>

          <form class="space-y-4" (ngSubmit)="onSendCode()">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
              <input
                type="email"
                [(ngModel)]="email"
                name="email"
                autocomplete="email"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="email@example.com"
              />
            </div>

            @if (errorMessage()) {
              <p class="text-red-500 text-sm">{{ errorMessage() }}</p>
            }

            <button
              type="submit"
              [disabled]="loading()"
              class="w-full py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition disabled:opacity-50 cursor-pointer"
            >
              {{ loading() ? '送信中...' : 'リセットコードを送信' }}
            </button>

            <button
              type="button"
              (click)="navService.navigate({ page: 'login' })"
              class="w-full py-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition cursor-pointer"
            >
              戻る
            </button>
          </form>
        } @else {
          <!-- Step 2: コード + 新パスワード入力 -->
          <h1 class="text-2xl font-bold text-center text-gray-800 mb-4">新しいパスワードを設定</h1>
          <p class="text-sm text-gray-600 text-center mb-6">
            {{ email }} に送信されたコードと<br />新しいパスワードを入力してください。
          </p>

          <form class="space-y-4" (ngSubmit)="onConfirmReset()">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">確認コード</label>
              <input
                type="text"
                [(ngModel)]="confirmCode"
                name="confirmCode"
                autocomplete="one-time-code"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
                placeholder="123456"
                maxlength="6"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
              <input
                type="password"
                [(ngModel)]="newPassword"
                name="newPassword"
                autocomplete="new-password"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="新しいパスワードを入力"
              />
            </div>

            @if (errorMessage()) {
              <p class="text-red-500 text-sm">{{ errorMessage() }}</p>
            }

            @if (successMessage()) {
              <p class="text-green-500 text-sm">{{ successMessage() }}</p>
            }

            <button
              type="submit"
              [disabled]="loading()"
              class="w-full py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition disabled:opacity-50 cursor-pointer"
            >
              {{ loading() ? '設定中...' : 'パスワードを再設定' }}
            </button>

            <button
              type="button"
              (click)="showReset.set(false); errorMessage.set('')"
              class="w-full py-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition cursor-pointer"
            >
              戻る
            </button>
          </form>
        }

      </div>
    </div>
  `,
})
/** パスワードリセットコンポーネント。メール送信→コード+新パスワード入力の2ステップフロー */
export class ForgotPasswordComponent {
  private readonly authService = inject(AuthService);
  protected readonly navService = inject(NavigationService);

  /** メールアドレス入力値 */
  email = '';
  /** 確認コード入力値 */
  confirmCode = '';
  /** 新しいパスワード入力値 */
  newPassword = '';
  /** リセットコード入力画面を表示するかどうか */
  showReset = signal(false);
  /** 処理中フラグ */
  loading = signal(false);
  /** エラーメッセージ */
  errorMessage = signal('');
  /** 成功メッセージ */
  successMessage = signal('');

  /** リセットコード送信ボタンクリック時の処理 */
  async onSendCode() {
    if (!this.email) {
      this.errorMessage.set('メールアドレスを入力してください');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    const result = await this.authService.forgotPassword(this.email);

    if (result.success) {
      this.showReset.set(true);
    } else {
      this.errorMessage.set(result.error ?? 'コードの送信に失敗しました');
    }

    this.loading.set(false);
  }

  /** パスワード再設定ボタンクリック時の処理 */
  async onConfirmReset() {
    if (!this.confirmCode || !this.newPassword) {
      this.errorMessage.set('確認コードと新しいパスワードを入力してください');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const result = await this.authService.confirmForgotPassword(
      this.email,
      this.confirmCode,
      this.newPassword,
    );

    if (result.success) {
      this.successMessage.set('パスワードを再設定しました。ログイン画面に移動します...');
      setTimeout(() => this.navService.navigate({ page: 'login' }), 2000);
    } else {
      this.errorMessage.set(result.error ?? 'パスワードの再設定に失敗しました');
    }

    this.loading.set(false);
  }
}
