import { Component, inject, signal } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { NavigationService, ViewState } from '@core/services/navigation.service';
import { ToastService } from '@ui/components/toast/toast.service';

/** サイドバーのナビゲーション項目を表すインターフェース */
interface SidebarItem {
  /** 項目の一意ID */
  id: number;
  /** 表示名 */
  name: string;
  /** 遷移先ページ */
  page: ViewState['page'];
  /** タブ画像ファイル名 */
  img: string;
  /** ログイン必須かどうか */
  requiresLogin: boolean;
}

/** サイドバーに表示するナビゲーション項目の定義 */
const sidebarItems: SidebarItem[] = [
  { id: 0, name: '説明', page: 'landing', img: 'TsurumaruTsuyoshi.png', requiresLogin: false },
  { id: 1, name: 'ウマ娘情報登録', page: 'character-regist', img: 'SpecialWeek.png', requiresLogin: true },
  { id: 2, name: 'ウマ娘情報表示', page: 'character-list', img: 'SeiunSky.png', requiresLogin: true },
  { id: 3, name: 'レース情報表示', page: 'race-list', img: 'KingHalo.png', requiresLogin: true },
  { id: 4, name: '残レース計算表示', page: 'remaining-race', img: 'GrassWonder.png', requiresLogin: true },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [],
  template: `
    <!-- ハンバーガーボタン (PC・スマホ共通) -->
    <button
      class="fixed top-2 left-2 z-[60] bg-white/80 backdrop-blur-sm rounded-lg p-2 shadow-md border border-gray-200 cursor-pointer"
      (click)="toggleDrawer()"
    >
      @if (drawerOpen()) {
        <span class="block text-xl font-bold text-gray-700 leading-none">✕</span>
      } @else {
        <span class="block text-xl font-bold text-gray-700 leading-none">☰</span>
      }
    </button>

    <!-- 背景オーバーレイ (PC・スマホ共通) -->
    @if (drawerOpen()) {
      <div
        class="fixed inset-0 bg-black/50 z-40"
        (click)="closeDrawer()"
      ></div>
    }

    <!-- サイドバー本体 (常にスライドドロワー) -->
    <nav
      class="fixed top-0 left-0 h-full w-64 z-50
             bg-white/70 backdrop-blur-sm border-r border-gray-200 p-4 flex flex-col
             transition-transform duration-300"
      [class.-translate-x-full]="!drawerOpen()"
    >
      <h2 class="text-lg font-bold text-purple-600 mb-6 text-center">Uma Crown Simulator</h2>

      <ul class="flex-1 space-y-4">
        @for (item of items; track item.id) {
          <li>
            @if (!item.requiresLogin || authService.isLoggedIn()) {
              <!-- ログイン不要 or ログイン済み: 通常ボタン -->
              <button
                (click)="navigateTo(item.page)"
                class="block w-full text-center text-lg font-bold py-4 rounded-xl border-2 border-gray-300
                       bg-cover bg-center text-purple-500 transition-all duration-300
                       hover:bg-pink-200 cursor-pointer hover:text-white hover:scale-105 hover:shadow-lg"
                [class.!bg-pink-200]="isActive(item.page)"
                [class.!text-white]="isActive(item.page)"
                [class.!shadow-lg]="isActive(item.page)"
                [style.background-image]="'url(/image/SidebarTab/' + item.img + ')'"
              >
                {{ item.name }}
              </button>
            } @else {
              <!-- 未ログイン: グレーアウト + 🔒 -->
              <button
                (click)="onDisabledClick()"
                class="block w-full text-center text-lg font-bold py-4 rounded-xl border-2 border-gray-200
                       bg-gray-100 text-gray-400 cursor-not-allowed select-none opacity-60"
              >
                🔒 {{ item.name }}
              </button>
            }
          </li>
        }
      </ul>

      <!-- 下部: 初期化完了まではスピナー、完了後にログイン状態に応じてボタンを切り替え -->
      @if (!authService.isInitialized()) {
        <!-- セッション確認中スピナー -->
        <div class="mt-4 flex justify-center py-3">
          <div class="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      } @else if (authService.isLoggedIn()) {
        <button
          (click)="onLogout()"
          class="mt-4 w-full py-2 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 transition cursor-pointer"
        >
          ログアウト
        </button>
      } @else {
        <p class="text-red-500 text-xs text-center mt-2 mb-1 font-semibold">
          ⚠️ ログインすると利用できます
        </p>
        <div class="mt-1 flex flex-col gap-2">
          <button
            (click)="navigateToLogin()"
            class="w-full py-2 rounded-lg bg-blue-500 text-white font-bold hover:bg-blue-600 transition cursor-pointer"
          >
            ログイン
          </button>
          <button
            (click)="navigateToRegister()"
            class="w-full py-2 rounded-lg bg-green-500 text-white font-bold hover:bg-green-600 transition cursor-pointer"
          >
            会員登録
          </button>
        </div>
      }
    </nav>
  `,
})
/** アプリケーションのナビゲーションサイドバーコンポーネント */
export class SidebarComponent {
  /** サイドバーに表示するナビゲーション項目 */
  protected readonly items = sidebarItems;
  protected readonly authService = inject(AuthService);
  protected readonly navService = inject(NavigationService);
  private readonly toastService = inject(ToastService);

  /** ドロワーの開閉状態 */
  protected readonly drawerOpen = signal(false);

  /** ドロワーの開閉を切り替える */
  protected toggleDrawer(): void {
    this.drawerOpen.update((v: boolean) => !v);
  }

  /** ドロワーを閉じる */
  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  /** 指定ページが現在のアクティブページかどうかを返す */
  isActive(page: ViewState['page']): boolean {
    const current = this.navService.currentView().page;
    if (page === 'remaining-race') {
      return current === 'remaining-race' || current === 'remaining-race-pattern';
    }
    return current === page;
  }

  /** サイドバー項目のページに遷移する（umamusumeId不要なページのみ） */
  navigateTo(page: ViewState['page']): void {
    this.navService.navigate({ page } as ViewState);
    this.closeDrawer();
  }

  /** 未ログイン時に無効なボタンを押したときの処理 */
  onDisabledClick(): void {
    this.toastService.show('ログインが必要です', 'error');
  }

  /** ログインページへ遷移する */
  navigateToLogin(): void {
    this.navService.navigate({ page: 'login' });
    this.closeDrawer();
  }

  /** 会員登録ページへ遷移する */
  navigateToRegister(): void {
    this.navService.navigate({ page: 'register' });
    this.closeDrawer();
  }

  /** ログアウトボタンクリック時の処理 */
  onLogout(): void {
    this.authService.logout();
    this.navService.navigate({ page: 'landing' });
    this.closeDrawer();
  }
}
