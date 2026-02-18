import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../../shared/components/toast/toast.service';
import { environment } from '../../environments/environment';
import { RacePattern, RaceSlot, Umamusume } from '@shared/types';

/** 育成期カテゴリの識別子 */
type CategoryKey = 'junior' | 'classic' | 'senior';

/** レースパターンの詳細データ */
interface PatternData {
  /** 対象シナリオ名 */
  scenario: string;
  /** 戦略ごとのレース数マップ */
  strategy: Record<string, number>;
  /** 走行バ場（芝/ダートなど） */
  surface: string;
  /** 距離カテゴリ */
  distance: string;
  /** ジュニア期のレーススロット一覧 */
  junior: RaceSlot[];
  /** クラシック期のレーススロット一覧 */
  classic: RaceSlot[];
  /** シニア期のレーススロット一覧 */
  senior: RaceSlot[];
  /** 必要因子名の一覧 */
  factors: string[];
  /** パターン内の総レース数 */
  totalRaces: number;
}

@Component({
  selector: 'app-remaining-race-pattern',
  standalone: true,
  template: `
    <div class="space-y-4">
      <h2 class="text-xl font-bold text-center">レースパターンシミュレーション機能</h2>

      @if (patterns().length === 0) {
        <div class="text-center text-gray-500 py-8">
          <p>パターンを読み込み中...</p>
        </div>
      } @else {
        <div class="flex gap-6">
          <!-- 左カラム: キャラ情報 -->
          <div class="w-1/3 space-y-4">
            <!-- キャラ画像 -->
            <div class="p-2 bg-gradient-to-b from-green-400 to-green-100 rounded-xl shadow-lg">
              <div
                class="w-full h-64 rounded-lg bg-gray-100 bg-cover bg-center bg-no-repeat"
                [style.background-image]="'url(/image/umamusumeData/' + umamusumeName() + '.png)'"
              ></div>
            </div>

            <!-- シナリオ画像 -->
            @if (currentPattern()) {
              <div class="bg-white rounded-lg shadow p-4">
                <h3 class="font-bold mb-2">シナリオ</h3>
                <div
                  class="w-full h-32 rounded bg-cover bg-center"
                  [style.background-image]="'url(/image/scenario/' + currentPattern()!.scenario + '.png)'"
                ></div>
                <p class="text-center mt-1 text-sm font-semibold">{{ currentPattern()!.scenario }}</p>
              </div>

              <!-- 因子 -->
              @if (currentPattern()!.factors.length > 0) {
                <div class="bg-white rounded-lg shadow p-4">
                  <h3 class="font-bold mb-2">必要因子</h3>
                  <div class="flex flex-wrap gap-2">
                    @for (factor of currentPattern()!.factors; track factor) {
                      <div class="flex items-center gap-1">
                        <img
                          [src]="'/image/factor/' + factor + '.png'"
                          [alt]="factor"
                          class="w-8 h-8 rounded"
                          (error)="onImageError($event)"
                        />
                        <span class="text-xs">{{ factor }}</span>
                      </div>
                    }
                  </div>
                </div>
              }
            }

            <!-- 一括登録ボタン -->
            <button
              class="w-full bg-green-500 text-white py-3 rounded-lg font-bold hover:bg-green-600 transition cursor-pointer"
              (click)="registerPattern()"
            >
              パターン一括登録
            </button>

            <button
              class="w-full bg-red-500 text-white py-3 rounded-lg font-bold hover:bg-red-600 transition cursor-pointer"
              (click)="goBack()"
            >
              戻る
            </button>
          </div>

          <!-- 右カラム: パターン選択 + グリッド -->
          <div class="w-2/3 space-y-4">
            <!-- パターン選択タブ -->
            <div class="flex gap-2 flex-wrap">
              @for (p of patterns(); track $index) {
                <button
                  class="px-4 py-2 rounded-lg font-bold transition cursor-pointer"
                  [class]="selectedPattern() === $index
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
                  (click)="selectedPattern.set($index)"
                >
                  {{ $index + 1 }}回目
                </button>
              }
            </div>

            <!-- カテゴリタブ -->
            <div class="flex gap-2">
              @for (cat of categories; track cat.key) {
                <button
                  class="px-4 py-2 rounded-lg font-bold transition cursor-pointer"
                  [class]="selectedCategory() === cat.key
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
                  (click)="selectedCategory.set(cat.key)"
                >
                  {{ cat.label }}
                </button>
              }
            </div>

            <!-- レースグリッド -->
            <div class="grid grid-cols-4 gap-3">
              @for (race of currentRaces(); track race.race_id) {
                <div
                  class="border rounded-lg p-3 shadow-sm hover:shadow-md transition cursor-pointer bg-white"
                  (click)="registerOneRace(race)"
                >
                  <div
                    class="w-full h-20 rounded bg-cover bg-center mb-2"
                    [style.background-image]="'url(/image/raceData/' + race.race_name + '.png)'"
                  ></div>
                  <p class="text-xs font-bold text-center truncate">{{ race.race_name }}</p>
                  <div class="flex justify-center gap-1 mt-1">
                    <span
                      class="text-xs px-2 py-0.5 rounded text-white"
                      [class]="getDistanceColor(race.distance)"
                    >{{ getDistanceLabel(race.distance) }}</span>
                    <span
                      class="text-xs px-2 py-0.5 rounded text-white"
                      [class]="race.race_state === 0 ? 'bg-lime-500' : 'bg-amber-800'"
                    >{{ race.race_state === 0 ? '芝' : 'ダート' }}</span>
                  </div>
                  <p class="text-xs text-center text-gray-500 mt-1">
                    {{ race.month }}月{{ race.half ? '後半' : '前半' }}
                  </p>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
/** 残レースのパターンシミュレーションを表示・操作するコンポーネント */
export class RemainingRacePatternComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  /** 対象ウマ娘のID（URLパラメーターから取得） */
  private umamusumeId = 0;

  /** 取得したレースパターンの一覧 */
  patterns = signal<PatternData[]>([]);
  /** 対象ウマ娘の名前 */
  umamusumeName = signal('');
  /** 現在選択中のパターンインデックス */
  selectedPattern = signal(0);
  /** 現在選択中の育成期カテゴリ */
  selectedCategory = signal<CategoryKey>('junior');

  /** 育成期カテゴリのタブ定義 */
  categories: { key: CategoryKey; label: string }[] = [
    { key: 'junior', label: 'ジュニア期' },
    { key: 'classic', label: 'クラシック期' },
    { key: 'senior', label: 'シニア期' },
  ];

  /** コンポーネント初期化時にURLパラメーターを取得してパターンデータを読み込む */
  ngOnInit() {
    this.umamusumeId = Number(this.route.snapshot.paramMap.get('id'));
    this.fetchPattern();
  }

  /**
   * 現在選択中のパターンデータを返す
   * @returns 選択中のPatternData、存在しない場合はnull
   */
  currentPattern(): PatternData | null {
    const p = this.patterns();
    const idx = this.selectedPattern();
    return p[idx] ?? null;
  }

  /**
   * 現在選択中のカテゴリのレーススロット一覧を返す
   * @returns 選択中カテゴリのRaceSlot配列
   */
  currentRaces(): RaceSlot[] {
    const p = this.currentPattern();
    if (!p) return [];
    return p[this.selectedCategory()] ?? [];
  }

  /**
   * APIからレースパターンデータを取得してシグナルにセットする
   */
  private fetchPattern() {
    this.http
      .get<{ patterns: PatternData[]; umamusumeName?: string }>(
        `${environment.apiUrl}/races/patterns/${this.umamusumeId}`,
      )
      .subscribe({
        next: (res) => {
          this.patterns.set(res.patterns ?? []);
          if (res.umamusumeName) {
            this.umamusumeName.set(res.umamusumeName);
          }
        },
        error: (err) => {
          console.error('Failed to fetch race pattern:', err);
          this.toastService.show('パターン取得に失敗しました', 'error');
        },
      });
  }

  /** 現在選択中のパターンの全レースを一括登録する */
  registerPattern() {
    const p = this.currentPattern();
    if (!p) return;

    const allRaces = [...p.junior, ...p.classic, ...p.senior];

    this.http
      .post(`${environment.apiUrl}/races/results/batch`, {
        umamusumeId: this.umamusumeId,
        races: allRaces,
      })
      .subscribe({
        next: () => this.toastService.show('パターンを一括登録しました', 'success'),
        error: (err) => {
          console.error('Failed to register pattern:', err);
          this.toastService.show('パターン登録に失敗しました', 'error');
        },
      });
  }

  /**
   * 指定したレースを1件登録する
   * @param race - 登録対象のレーススロット
   */
  registerOneRace(race: RaceSlot) {
    this.http
      .post(`${environment.apiUrl}/races/results`, {
        umamusumeId: this.umamusumeId,
        race,
      })
      .subscribe({
        next: () => this.toastService.show(`${race.race_name} を登録しました`, 'success'),
        error: (err) => {
          console.error('Failed to register race:', err);
          this.toastService.show('レース登録に失敗しました', 'error');
        },
      });
  }

  /** 残レース一覧画面に戻る */
  goBack() {
    this.router.navigate(['/remaining-race']);
  }

  /**
   * 画像読み込みエラー時に画像要素を非表示にする
   * @param event - エラーイベント
   */
  onImageError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  /**
   * 距離コードに対応する日本語ラベルを返す
   * @param d - 距離コード（1=短距離, 2=マイル, 3=中距離, 4=長距離）
   * @returns 距離の日本語表示文字列
   */
  getDistanceLabel(d: number): string {
    switch (d) {
      case 1: return '短距離';
      case 2: return 'マイル';
      case 3: return '中距離';
      case 4: return '長距離';
      default: return '';
    }
  }

  /**
   * 距離コードに対応するTailwindCSSの背景色クラスを返す
   * @param d - 距離コード（1=短距離, 2=マイル, 3=中距離, 4=長距離）
   * @returns 背景色のCSSクラス文字列
   */
  getDistanceColor(d: number): string {
    switch (d) {
      case 1: return 'bg-pink-300';
      case 2: return 'bg-green-500';
      case 3: return 'bg-yellow-300';
      case 4: return 'bg-blue-500';
      default: return 'bg-gray-400';
    }
  }
}
