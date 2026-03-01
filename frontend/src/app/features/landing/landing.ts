import { Component, inject } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { NavigationService } from '@core/services/navigation.service';

/** 各機能の概要を表すインターフェース */
interface FeatureCard {
  /** 機能名 */
  title: string;
  /** できること */
  description: string;
}

/** LPに表示する機能カードの定義 */
const featureCards: FeatureCard[] = [
  {
    title: 'ウマ娘情報登録',
    description: '育成したウマ娘の適性・因子情報を登録できます。',
  },
  {
    title: 'ウマ娘情報表示',
    description: '登録済みのウマ娘情報を一覧で確認できます。',
  },
  {
    title: 'レース情報表示',
    description: '全冠称号に必要なレースの一覧を確認できます。',
  },
  {
    title: '残レース計算表示',
    description: '適性ごとの残レースを照合し、全冠称号までの出走パターンを計算できます。',
  },
];

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [],
  template: `
    <div
      class="min-h-screen bg-cover bg-center bg-no-repeat flex flex-col"
      style="background-image: url('/image/backgroundFile/landing-bg.png')"
    >
      <!-- ヒーローセクション -->
      <div class="flex flex-col items-center justify-center pt-16 pb-10 px-4 text-center">
        <h1 class="text-4xl font-extrabold text-white drop-shadow-lg mb-3">
          Uma Crown Simulator
        </h1>
        <p class="text-lg font-semibold text-white/90 drop-shadow mb-8">
          全冠称号までのオールインワンアプリ
        </p>

        <!-- セッション確認完了後、未ログイン時のみログイン・会員登録ボタンを表示 -->
        @if (authService.isInitialized() && !authService.isLoggedIn()) {
          <div class="flex gap-4">
            <button
              (click)="navService.navigate({ page: 'login' })"
              class="px-8 py-3 bg-blue-500 text-white font-bold rounded-xl shadow-lg
                     hover:bg-blue-600 transition-all duration-200 hover:scale-105 cursor-pointer"
            >
              ログイン
            </button>
            <button
              (click)="navService.navigate({ page: 'register' })"
              class="px-8 py-3 bg-green-500 text-white font-bold rounded-xl shadow-lg
                     hover:bg-green-600 transition-all duration-200 hover:scale-105 cursor-pointer"
            >
              会員登録
            </button>
          </div>
        }
      </div>

      <!-- 機能カードセクション -->
      <div class="flex-1 px-6 pb-10">
        <div class="flex flex-col gap-4 max-w-3xl mx-auto">
          @for (card of cards; track card.title) {
            <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/60
                        flex items-center gap-6 px-8 py-5">
              <h2 class="text-base font-bold text-purple-700 w-40 shrink-0">{{ card.title }}</h2>
              <p class="text-sm text-gray-700 leading-relaxed">{{ card.description }}</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
/** アプリのランディングページ。各機能の概要とキャッチコピーを表示する */
export class LandingComponent {
  protected readonly authService = inject(AuthService);
  protected readonly navService = inject(NavigationService);
  /** 機能カードの一覧 */
  protected readonly cards = featureCards;
}
