import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="fixed inset-0 flex items-center justify-center bg-cover bg-center bg-no-repeat"
         style="background-image: url('/image/backgroundFile/login-bg.png')">
      <div class="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-8 w-full max-w-md overflow-y-auto max-h-[90vh]">

        @if (!showConfirm()) {
          <!-- Step 1: 新規登録 -->
          <h1 class="text-2xl font-bold text-center text-gray-800 mb-6">新規登録</h1>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
              <input
                type="email"
                [(ngModel)]="email"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
              <input
                type="password"
                [(ngModel)]="password"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="パスワードを入力"
              />
            </div>

            @if (errorMessage()) {
              <p class="text-red-500 text-sm">{{ errorMessage() }}</p>
            }

            <button
              (click)="onRegister()"
              [disabled]="loading()"
              class="w-full py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition disabled:opacity-50 cursor-pointer"
            >
              {{ loading() ? '登録中...' : '新規登録' }}
            </button>

            <button
              routerLink="/login"
              class="w-full py-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition cursor-pointer"
            >
              戻る
            </button>
          </div>
        } @else {
          <!-- Step 2: 確認コード入力 -->
          <h1 class="text-2xl font-bold text-center text-gray-800 mb-4">メール確認</h1>
          <p class="text-sm text-gray-600 text-center mb-6">
            {{ email }} に確認コードを送信しました。<br />メールに記載された6桁のコードを入力してください。
          </p>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">確認コード</label>
              <input
                type="text"
                [(ngModel)]="confirmCode"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-center text-2xl tracking-widest"
                placeholder="123456"
                maxlength="6"
              />
            </div>

            @if (errorMessage()) {
              <p class="text-red-500 text-sm">{{ errorMessage() }}</p>
            }

            @if (successMessage()) {
              <p class="text-green-500 text-sm">{{ successMessage() }}</p>
            }

            <button
              (click)="onConfirm()"
              [disabled]="loading()"
              class="w-full py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition disabled:opacity-50 cursor-pointer"
            >
              {{ loading() ? '確認中...' : 'アカウントを有効化' }}
            </button>

            <button
              (click)="onResendCode()"
              [disabled]="loading()"
              class="w-full py-2 text-blue-500 hover:underline text-sm cursor-pointer disabled:opacity-50"
            >
              確認コードを再送信
            </button>

            <button
              (click)="showConfirm.set(false); errorMessage.set('')"
              class="w-full py-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition cursor-pointer"
            >
              戻る
            </button>
          </div>
        }

      </div>
    </div>
  `,
})
export class RegisterComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  confirmCode = '';
  showConfirm = signal(false);
  loading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  async onRegister() {
    if (!this.email || !this.password) {
      this.errorMessage.set('メールアドレスとパスワードを入力してください');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    const result = await this.authService.signUp(this.email, this.password);

    if (result.success) {
      this.showConfirm.set(true);
    } else {
      this.errorMessage.set(result.error ?? '登録に失敗しました');
    }

    this.loading.set(false);
  }

  async onConfirm() {
    if (!this.confirmCode) {
      this.errorMessage.set('確認コードを入力してください');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const result = await this.authService.confirmSignUp(this.email, this.confirmCode);

    if (result.success) {
      this.successMessage.set('アカウントが有効化されました。ログイン画面に移動します...');
      setTimeout(() => this.router.navigate(['/login']), 2000);
    } else {
      this.errorMessage.set(result.error ?? '確認に失敗しました');
    }

    this.loading.set(false);
  }

  async onResendCode() {
    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const result = await this.authService.resendConfirmationCode(this.email);

    if (result.success) {
      this.successMessage.set('確認コードを再送信しました');
    } else {
      this.errorMessage.set(result.error ?? '再送信に失敗しました');
    }

    this.loading.set(false);
  }
}
