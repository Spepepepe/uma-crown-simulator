import { Component, computed, inject, signal, OnInit, Input } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../shared/components/toast/toast.service';
import { NavigationService } from '../../core/services/navigation.service';
import { environment } from '../../environments/environment';
import { RaceSlot } from '@shared/types';

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

/** 月ごとの前半・後半スロットデータ */
interface MonthSlot {
  month: number;
  first: RaceSlot | null;
  second: RaceSlot | null;
}

@Component({
  selector: 'app-remaining-race-pattern',
  standalone: true,
  template: `
    <div class="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
         style="background-image: url('/image/backgroundFile/remaining-race-list.png')"></div>
    <div class="pt-4">
      <!-- タイトル -->
      <div class="text-center mb-4">
        <h1 class="text-3xl font-bold text-purple-600" style="font-family: 'Comic Sans MS', cursive">
          レースパターンシミュレーション機能
        </h1>
      </div>

      @if (patterns().length === 0) {
        <div class="text-center text-gray-500 py-8">
          <p>パターンを読み込み中...</p>
        </div>
      } @else {
        <div class="max-w-6xl mx-auto bg-gray-100">
          <div class="flex">
            <!-- 左カラム: ウマ娘情報と因子 -->
            <div class="w-1/3 p-4 space-y-4">
              <!-- ウマ娘情報 -->
              <div class="bg-white rounded-lg p-6 text-center">
                <div class="text-xl font-bold text-pink-600 mb-4" style="font-family: 'Comic Sans MS', cursive">
                  {{ umamusumeName() }}
                </div>
                <div
                  class="w-32 h-32 mx-auto rounded-full"
                  [style.background-image]="'url(/image/umamusumeData/' + umamusumeName() + '.png)'"
                  style="background-size: cover; background-position: center; background-repeat: no-repeat;"
                ></div>
              </div>

              <!-- 選択シナリオ -->
              @if (currentPattern()) {
                <div class="bg-white rounded-lg p-4">
                  <div class="font-medium mb-2" style="font-family: 'Comic Sans MS', cursive">選択シナリオ</div>
                  <div class="flex justify-center">
                    <div
                      class="w-48 h-32 rounded-lg"
                      [style.background-image]="'url(/image/scenario/' + currentPattern()!.scenario + '.png)'"
                      style="background-size: 100% 100%; background-position: center; background-repeat: no-repeat;"
                    ></div>
                  </div>
                </div>

                <!-- 必要因子 -->
                @if (currentPattern()!.factors.length > 0) {
                  <div class="bg-white rounded-lg p-4">
                    <div class="font-medium mb-3" style="font-family: 'Comic Sans MS', cursive">必要因子</div>
                    @for (factor of currentPattern()!.factors; track factor) {
                      <div class="mb-2 flex justify-center">
                        @if (factor !== '自由') {
                          <div
                            class="w-48 h-10 rounded-lg"
                            [attr.aria-label]="factor"
                            [style.background-image]="'url(/image/factor/' + factor + '.png)'"
                            style="background-size: 100% 100%; background-position: center; background-repeat: no-repeat;"
                          ></div>
                        } @else {
                          <div class="w-24 h-10 flex items-center justify-center">
                            <span class="font-medium" style="font-family: 'Comic Sans MS', cursive">{{ factor }}</span>
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              }

              <!-- パターン出走完了ボタン -->
              <div class="bg-white rounded-lg p-4">
                <button
                  (click)="registerPattern()"
                  [disabled]="!currentPattern()"
                  class="w-full bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
                  style="font-family: 'Comic Sans MS', cursive"
                >
                  現在のパターンを出走完了にする
                </button>
              </div>
            </div>

            <!-- 右カラム: パターン選択とレースグリッド -->
            <div class="w-2/3 p-4">
              <!-- パターン選択タブ -->
              <div class="bg-white flex rounded-full mb-4 p-1">
                @for (p of patterns(); track $index; let i = $index) {
                  <button
                    (click)="selectedPattern.set(i)"
                    class="flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all"
                    [class.bg-blue-500]="selectedPattern() === i"
                    [class.text-white]="selectedPattern() === i"
                    [class.text-gray-600]="selectedPattern() !== i"
                    style="font-family: 'Comic Sans MS', cursive"
                  >
                    {{ i + 1 }}回目
                  </button>
                }
              </div>

              <!-- カテゴリタブ -->
              <div class="bg-white flex rounded-full mb-6 p-1">
                @for (cat of categories; track cat.key) {
                  <button
                    (click)="selectedCategory.set(cat.key)"
                    class="flex-1 py-3 px-6 rounded-full text-sm font-medium transition-all"
                    [class.bg-green-500]="selectedCategory() === cat.key"
                    [class.text-white]="selectedCategory() === cat.key"
                    [class.text-gray-600]="selectedCategory() !== cat.key"
                    style="font-family: 'Comic Sans MS', cursive"
                  >
                    {{ cat.label }}
                  </button>
                }
              </div>

              <!-- レースグリッド (4列 × 6行 = 24スロット) -->
              <div class="grid grid-cols-4 gap-x-2 gap-y-2">
                @for (slot of monthGrid(); track slot.month) {
                  <!-- 前半 -->
                  <div class="flex flex-col items-center relative pb-3">
                    <button
                      (click)="registerOneRace(slot.first!)"
                      [disabled]="!slot.first"
                      class="w-32 h-20 rounded-lg flex items-center justify-center text-sm font-medium transition-all bg-gray-400 mt-1 disabled:cursor-not-allowed hover:enabled:opacity-80 focus:outline-none"
                      [style.background-image]="slot.first ? 'url(/image/raceData/' + slot.first.race_name + '.png)' : 'none'"
                      style="background-size: contain; background-position: center; background-repeat: no-repeat; border: 1px solid #374151;"
                    >
                      @if (!slot.first) {
                        <div class="text-gray-700 text-base font-bold">未出走</div>
                      }
                    </button>
                    @if (slot.first) {
                      <div class="flex justify-center gap-2 w-32 text-xs font-bold mt-1">
                        <span [class]="'px-1 rounded ' + getDistanceBgColor(slot.first.distance)">{{ getDistanceLabel(slot.first.distance) }}</span>
                        <span [class]="'px-1 rounded ' + getSurfaceBgColor(slot.first.race_state)">{{ slot.first.race_state === 0 ? '芝' : 'ダート' }}</span>
                      </div>
                    }
                    <div class="text-xs text-gray-700 font-medium">{{ slot.month }}月 前半</div>
                  </div>

                  <!-- 後半 -->
                  <div class="flex flex-col items-center relative pb-3">
                    <button
                      (click)="registerOneRace(slot.second!)"
                      [disabled]="!slot.second"
                      class="w-32 h-20 rounded-lg flex items-center justify-center text-sm font-medium transition-all bg-gray-400 mt-1 disabled:cursor-not-allowed hover:enabled:opacity-80 focus:outline-none"
                      [style.background-image]="slot.second ? 'url(/image/raceData/' + slot.second.race_name + '.png)' : 'none'"
                      style="background-size: contain; background-position: center; background-repeat: no-repeat; border: 1px solid #374151;"
                    >
                      @if (!slot.second) {
                        <div class="text-gray-700 text-base font-bold">未出走</div>
                      }
                    </button>
                    @if (slot.second) {
                      <div class="flex justify-center gap-2 w-32 text-xs font-bold mt-1">
                        <span [class]="'px-1 rounded ' + getDistanceBgColor(slot.second.distance)">{{ getDistanceLabel(slot.second.distance) }}</span>
                        <span [class]="'px-1 rounded ' + getSurfaceBgColor(slot.second.race_state)">{{ slot.second.race_state === 0 ? '芝' : 'ダート' }}</span>
                      </div>
                    }
                    <div class="text-xs text-gray-700 font-medium">{{ slot.month }}月 後半</div>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>

        <!-- 戻るボタン -->
        <div class="w-full text-center mt-4 pb-4">
          <button
            (click)="goBack()"
            class="bg-red-500 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-lg text-xl"
            style="font-family: 'Comic Sans MS', cursive"
          >
            戻る
          </button>
        </div>
      }
    </div>
  `,
})
/** 残レースのパターンシミュレーションを表示・操作するコンポーネント */
export class RemainingRacePatternComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toastService = inject(ToastService);
  private readonly navService = inject(NavigationService);

  /** 対象ウマ娘のID（親コンポーネントから受け取る） */
  @Input() umamusumeId = 0;

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

  /** 現在選択中のパターンデータ */
  currentPattern = computed<PatternData | null>(() => {
    const p = this.patterns();
    const idx = this.selectedPattern();
    return p[idx] ?? null;
  });

  /** 現在選択中カテゴリの全12ヶ月スロット（前半・後半）を返す */
  monthGrid = computed<MonthSlot[]>(() => {
    const p = this.currentPattern();
    const catKey = this.selectedCategory();
    const races: RaceSlot[] = p ? (p[catKey] ?? []) : [];

    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      return {
        month,
        first: races.find(r => r.month === month && !r.half) ?? null,
        second: races.find(r => r.month === month && r.half) ?? null,
      };
    });
  });

  /** コンポーネント初期化時にパターンデータを読み込む */
  ngOnInit() {
    this.fetchPattern();
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
    this.navService.navigate({ page: 'remaining-race' });
  }

  /**
   * 距離コードに対応する日本語ラベルを返す
   * @param d - 距離コード（1=短距離, 2=マイル, 3=中距離, 4=長距離）
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
   */
  getDistanceBgColor(d: number): string {
    switch (d) {
      case 1: return 'bg-pink-300';
      case 2: return 'bg-green-500';
      case 3: return 'bg-yellow-300';
      case 4: return 'bg-blue-500';
      default: return 'bg-gray-400';
    }
  }

  /**
   * バ場コードに対応するTailwindCSSの背景色クラスを返す
   * @param raceState - バ場コード（0=芝, 1=ダート）
   */
  getSurfaceBgColor(raceState: number): string {
    return raceState === 0 ? 'bg-lime-400' : 'bg-amber-800';
  }
}
