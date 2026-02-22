import { Component, computed, inject, signal, OnInit, Input } from '@angular/core';
import { ToastService } from '@ui/components/toast/toast.service';
import { NavigationService } from '@core/services/navigation.service';
import { GradeName, MonthSlot, RacePattern, RaceSlot } from '@shared/types';
import { RaceService } from '@core/services/race.service';
import { getDistanceLabel, } from '@ui/utils/race-formatter';
import { getDistanceBgColor, getSurfaceBgColor } from '@ui/utils/color-mapper';

type CategoryKey = GradeName;

@Component({
  selector: 'app-remaining-race-pattern',
  standalone: true,
  template: `
    <div class="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
         style="background-image: url('/image/backgroundFile/remaining-race-list.png')"></div>

    <!-- ========== スマホレイアウト (sm未満) ========== -->
    <div class="sm:hidden min-h-screen p-3 pb-8 flex flex-col gap-3">
      @if (patterns().length === 0) {
        <div class="flex-1 flex justify-center items-center py-20">
          <p class="text-gray-300 text-lg">パターンを読み込み中...</p>
        </div>
      } @else {
        <!-- A: ウマ娘画像と名前 -->
        <div class="bg-white/90 rounded-xl p-3 flex items-center gap-3 shadow">
          <div
            class="w-16 h-16 rounded-full flex-shrink-0"
            [style.background-image]="'url(/image/umamusumeData/' + umamusumeName() + '.png)'"
            style="background-size: cover; background-position: center; background-repeat: no-repeat;"
          ></div>
          <div class="text-lg font-bold text-pink-600" style="font-family: 'Comic Sans MS', cursive">
            {{ umamusumeName() }}
          </div>
        </div>

        @if (currentPattern()) {
          <!-- B: 選択シナリオ -->
          <div class="bg-white/90 rounded-xl p-3 shadow">
            <div class="text-xs font-bold text-gray-500 mb-2" style="font-family: 'Comic Sans MS', cursive">選択シナリオ</div>
            <div class="flex justify-center">
              <div
                class="w-40 h-24 rounded-lg"
                [style.background-image]="'url(/image/scenario/' + currentPattern()!.scenario + '.png)'"
                style="background-size: 100% 100%; background-position: center; background-repeat: no-repeat;"
              ></div>
            </div>
          </div>

          <!-- C: 必要因子 (2列グリッド) -->
          @if (currentPattern()!.factors.length > 0) {
            <div class="bg-white/90 rounded-xl p-3 shadow">
              <div class="text-xs font-bold text-gray-500 mb-2" style="font-family: 'Comic Sans MS', cursive">必要因子</div>
              <div class="grid grid-cols-2 gap-2">
                @for (factor of currentPattern()!.factors; track factor) {
                  @if (factor !== '自由') {
                    <div
                      class="h-9 rounded-lg"
                      [attr.aria-label]="factor"
                      [style.background-image]="'url(/image/factor/' + factor + '.png)'"
                      style="background-size: 100% 100%; background-position: center; background-repeat: no-repeat;"
                    ></div>
                  } @else {
                    <div class="h-9 flex items-center justify-center font-medium text-gray-700" style="font-family: 'Comic Sans MS', cursive">
                      自由
                    </div>
                  }
                }
              </div>
            </div>
          }
        }

        <!-- パターン選択タブ -->
        <div class="bg-white/90 flex rounded-full p-1 shadow">
          @for (p of patterns(); track $index; let i = $index) {
            <button
              (click)="selectedPattern.set(i)"
              class="flex-1 py-2 px-3 rounded-full text-sm font-medium transition-all cursor-pointer"
              [class.bg-blue-500]="selectedPattern() === i"
              [class.text-white]="selectedPattern() === i"
              [class.text-gray-600]="selectedPattern() !== i"
              style="font-family: 'Comic Sans MS', cursive"
            >{{ i + 1 }}</button>
          }
        </div>

        <!-- カテゴリタブ -->
        <div class="bg-white/90 flex rounded-full p-1 shadow">
          @for (cat of categories; track cat.key) {
            <button
              (click)="selectedCategory.set(cat.key)"
              class="flex-1 py-2 px-1 rounded-full text-xs font-medium transition-all cursor-pointer"
              [class.bg-green-500]="selectedCategory() === cat.key"
              [class.text-white]="selectedCategory() === cat.key"
              [class.text-gray-600]="selectedCategory() !== cat.key"
              style="font-family: 'Comic Sans MS', cursive"
            >{{ cat.label }}</button>
          }
        </div>

        <!-- D: レースグリッド (スマホ用サイズ) -->
        <div class="bg-white/90 rounded-xl p-2 shadow">
          <div class="grid grid-cols-4 gap-x-1 gap-y-2">
            @for (slot of monthGrid(); track slot.month) {
              <!-- 前半 -->
              <div class="flex flex-col items-center min-w-0 overflow-hidden">
                <button
                  (click)="registerOneRace(slot.first!)"
                  [disabled]="!slot.first"
                  class="w-full h-14 rounded-md flex items-center justify-center transition-all bg-gray-300 disabled:cursor-not-allowed hover:enabled:opacity-80 focus:outline-none cursor-pointer"
                  [style.background-image]="slot.first ? 'url(/image/raceData/' + slot.first.race_name + '.png)' : 'none'"
                  style="background-size: contain; background-position: center; background-repeat: no-repeat; border: 1px solid #374151;"
                >
                  @if (!slot.first) {
                    <div class="text-gray-600 text-[10px] font-bold">未出走</div>
                  }
                </button>
                <div class="flex items-center justify-center gap-0.5 mt-0.5 w-full overflow-hidden h-4">
                  @if (slot.first) {
                    <span class="text-[9px] font-bold px-0.5 rounded shrink-0" [class]="getDistanceBgColor(slot.first.distance)">{{ getDistanceLabel(slot.first.distance) }}</span>
                    <span class="text-[9px] font-bold px-0.5 rounded shrink-0" [class]="getSurfaceBgColor(slot.first.race_state)">{{ slot.first.race_state === 0 ? '芝' : 'ダ' }}</span>
                  }
                </div>
                <div class="text-[9px] text-gray-700 font-medium text-center leading-tight">{{ slot.month }}月前</div>
              </div>

              <!-- 後半 -->
              <div class="flex flex-col items-center min-w-0 overflow-hidden">
                <button
                  (click)="registerOneRace(slot.second!)"
                  [disabled]="!slot.second"
                  class="w-full h-14 rounded-md flex items-center justify-center transition-all bg-gray-300 disabled:cursor-not-allowed hover:enabled:opacity-80 focus:outline-none cursor-pointer"
                  [style.background-image]="slot.second ? 'url(/image/raceData/' + slot.second.race_name + '.png)' : 'none'"
                  style="background-size: contain; background-position: center; background-repeat: no-repeat; border: 1px solid #374151;"
                >
                  @if (!slot.second) {
                    <div class="text-gray-600 text-[10px] font-bold">未出走</div>
                  }
                </button>
                <div class="flex items-center justify-center gap-0.5 mt-0.5 w-full overflow-hidden h-4">
                  @if (slot.second) {
                    <span class="text-[9px] font-bold px-0.5 rounded shrink-0" [class]="getDistanceBgColor(slot.second.distance)">{{ getDistanceLabel(slot.second.distance) }}</span>
                    <span class="text-[9px] font-bold px-0.5 rounded shrink-0" [class]="getSurfaceBgColor(slot.second.race_state)">{{ slot.second.race_state === 0 ? '芝' : 'ダ' }}</span>
                  }
                </div>
                <div class="text-[9px] text-gray-700 font-medium text-center leading-tight">{{ slot.month }}月後</div>
              </div>
            }
          </div>
        </div>

        <!-- E: パターン完了ボタン -->
        <button
          (click)="registerPattern()"
          [disabled]="!currentPattern()"
          class="w-full bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl transition-all disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer shadow"
          style="font-family: 'Comic Sans MS', cursive"
        >現在のパターンを出走完了にする</button>

        <!-- F: 戻るボタン -->
        <button
          (click)="goBack()"
          class="w-full bg-red-500 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl cursor-pointer shadow"
          style="font-family: 'Comic Sans MS', cursive"
        >戻る</button>
      }
    </div>

    <!-- ========== PCレイアウト (sm以上) ========== -->
    <div class="hidden sm:flex h-screen overflow-hidden flex-col p-3">
      @if (patterns().length === 0) {
        <div class="flex-1 flex justify-center items-center">
          <p class="text-gray-500 text-xl">パターンを読み込み中...</p>
        </div>
      } @else {
        <div class="flex-1 overflow-hidden max-w-6xl mx-auto w-full bg-gray-100 rounded-xl shadow-lg flex">

          <!-- 左カラム: ウマ娘情報と因子 -->
          <div class="w-80 flex-shrink-0 p-3 flex flex-col gap-3 overflow-y-auto">
            <!-- ウマ娘情報 -->
            <div class="bg-white rounded-lg p-4 text-center">
              <div class="text-lg font-bold text-pink-600 mb-2" style="font-family: 'Comic Sans MS', cursive">
                {{ umamusumeName() }}
              </div>
              <div
                class="w-24 h-24 mx-auto rounded-full"
                [style.background-image]="'url(/image/umamusumeData/' + umamusumeName() + '.png)'"
                style="background-size: cover; background-position: center; background-repeat: no-repeat;"
              ></div>
            </div>

            <!-- 選択シナリオ -->
            @if (currentPattern()) {
              <div class="bg-white rounded-lg p-3">
                <div class="font-medium text-sm mb-2" style="font-family: 'Comic Sans MS', cursive">選択シナリオ</div>
                <div class="flex justify-center">
                  <div
                    class="w-40 h-24 rounded-lg"
                    [style.background-image]="'url(/image/scenario/' + currentPattern()!.scenario + '.png)'"
                    style="background-size: 100% 100%; background-position: center; background-repeat: no-repeat;"
                  ></div>
                </div>
              </div>

              <!-- 必要因子 -->
              @if (currentPattern()!.factors.length > 0) {
                <div class="bg-white rounded-lg p-3">
                  <div class="font-medium text-sm mb-2" style="font-family: 'Comic Sans MS', cursive">必要因子</div>
                  @for (factor of currentPattern()!.factors; track factor) {
                    <div class="mb-1 flex justify-center">
                      @if (factor !== '自由') {
                        <div
                          class="w-40 h-9 rounded-lg"
                          [attr.aria-label]="factor"
                          [style.background-image]="'url(/image/factor/' + factor + '.png)'"
                          style="background-size: 100% 100%; background-position: center; background-repeat: no-repeat;"
                        ></div>
                      } @else {
                        <div class="w-24 h-9 flex items-center justify-center">
                          <span class="font-medium" style="font-family: 'Comic Sans MS', cursive">{{ factor }}</span>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            }

            <!-- ボタン群 -->
            <div class="flex flex-col gap-2">
              <button
                (click)="registerPattern()"
                [disabled]="!currentPattern()"
                class="w-full bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-all disabled:bg-gray-400 disabled:cursor-not-allowed text-sm cursor-pointer"
                style="font-family: 'Comic Sans MS', cursive"
              >
                現在のパターンを出走完了にする
              </button>
              <button
                (click)="goBack()"
                class="w-full bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-sm cursor-pointer"
                style="font-family: 'Comic Sans MS', cursive"
              >
                戻る
              </button>
            </div>
          </div>

          <!-- 右カラム: パターン選択とレースグリッド -->
          <div class="flex-1 p-3 flex flex-col overflow-hidden">
            <!-- パターン選択タブ -->
            <div class="bg-white flex rounded-full mb-2 p-1 flex-shrink-0">
              @for (p of patterns(); track $index; let i = $index) {
                <button
                  (click)="selectedPattern.set(i)"
                  class="flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all cursor-pointer"
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
            <div class="bg-white flex rounded-full mb-3 p-1 flex-shrink-0">
              @for (cat of categories; track cat.key) {
                <button
                  (click)="selectedCategory.set(cat.key)"
                  class="flex-1 py-2 px-6 rounded-full text-sm font-medium transition-all cursor-pointer"
                  [class.bg-green-500]="selectedCategory() === cat.key"
                  [class.text-white]="selectedCategory() === cat.key"
                  [class.text-gray-600]="selectedCategory() !== cat.key"
                  style="font-family: 'Comic Sans MS', cursive"
                >
                  {{ cat.label }}
                </button>
              }
            </div>

            <!-- レースグリッド (縦横フル活用) -->
            <div class="flex-1 min-h-0 overflow-y-auto">
              <div class="grid grid-cols-4 grid-rows-6 gap-x-2 gap-y-1 min-h-full">
                @for (slot of monthGrid(); track slot.month) {
                  <!-- 前半 -->
                  <div class="flex flex-col items-center h-full">
                    <button
                      (click)="registerOneRace(slot.first!)"
                      [disabled]="!slot.first"
                      class="w-full flex-1 min-h-0 rounded-lg flex items-center justify-center text-sm font-medium transition-all bg-gray-400 mt-1 disabled:cursor-not-allowed hover:enabled:opacity-80 focus:outline-none cursor-pointer"
                      [style.background-image]="slot.first ? 'url(/image/raceData/' + slot.first.race_name + '.png)' : 'none'"
                      style="background-size: contain; background-position: center; background-repeat: no-repeat; border: 1px solid #374151;"
                    >
                      @if (!slot.first) {
                        <div class="text-gray-700 text-sm font-bold">未出走</div>
                      }
                    </button>
                    <div class="h-5 mt-0.5 flex items-center justify-center gap-1 w-full text-xs font-bold">
                      @if (slot.first) {
                        <span [class]="'px-1 rounded ' + getDistanceBgColor(slot.first.distance)">{{ getDistanceLabel(slot.first.distance) }}</span>
                        <span [class]="'px-1 rounded ' + getSurfaceBgColor(slot.first.race_state)">{{ slot.first.race_state === 0 ? '芝' : 'ダート' }}</span>
                      }
                    </div>
                    <div class="text-xs text-gray-700 font-medium pb-1">{{ slot.month }}月 前半</div>
                  </div>

                  <!-- 後半 -->
                  <div class="flex flex-col items-center h-full">
                    <button
                      (click)="registerOneRace(slot.second!)"
                      [disabled]="!slot.second"
                      class="w-full flex-1 min-h-0 rounded-lg flex items-center justify-center text-sm font-medium transition-all bg-gray-400 mt-1 disabled:cursor-not-allowed hover:enabled:opacity-80 focus:outline-none cursor-pointer"
                      [style.background-image]="slot.second ? 'url(/image/raceData/' + slot.second.race_name + '.png)' : 'none'"
                      style="background-size: contain; background-position: center; background-repeat: no-repeat; border: 1px solid #374151;"
                    >
                      @if (!slot.second) {
                        <div class="text-gray-700 text-sm font-bold">未出走</div>
                      }
                    </button>
                    <div class="h-5 mt-0.5 flex items-center justify-center gap-1 w-full text-xs font-bold">
                      @if (slot.second) {
                        <span [class]="'px-1 rounded ' + getDistanceBgColor(slot.second.distance)">{{ getDistanceLabel(slot.second.distance) }}</span>
                        <span [class]="'px-1 rounded ' + getSurfaceBgColor(slot.second.race_state)">{{ slot.second.race_state === 0 ? '芝' : 'ダート' }}</span>
                      }
                    </div>
                    <div class="text-xs text-gray-700 font-medium pb-1">{{ slot.month }}月 後半</div>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
/** 残レースのパターンシミュレーションを表示・操作するコンポーネント */
export class RemainingRacePatternComponent implements OnInit {
  private readonly raceService = inject(RaceService);
  private readonly toastService = inject(ToastService);
  private readonly navService = inject(NavigationService);

  /** 対象ウマ娘のID（親コンポーネントから受け取る） */
  @Input() umamusumeId = 0;

  /** 取得したレースパターンの一覧 */
  patterns = signal<RacePattern[]>([]);
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
  currentPattern = computed<RacePattern | null>(() => {
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
        first: races.find(r => r.month === month && !r.half && r.race_id != null) ?? null,
        second: races.find(r => r.month === month && r.half && r.race_id != null) ?? null,
      };
    });
  });

  /** コンポーネント初期化時にパターンデータを読み込む */
  ngOnInit() {
    this.fetchPattern();
  }

  /** APIからレースパターンデータを取得してシグナルにセットする */
  private fetchPattern() {
    this.raceService.getPatterns(this.umamusumeId).subscribe({
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

    this.raceService.registerBatchResults(this.umamusumeId, allRaces).subscribe({
      next: () => this.toastService.show('パターンを一括登録しました', 'success'),
      error: (err) => {
        console.error('Failed to register pattern:', err);
        this.toastService.show('パターン登録に失敗しました', 'error');
      },
    });
  }

  /** 指定したレースを1件登録する */
  registerOneRace(race: RaceSlot) {
    this.raceService.registerOneResult(this.umamusumeId, race).subscribe({
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

  readonly getDistanceLabel = getDistanceLabel;
  readonly getDistanceBgColor = getDistanceBgColor;
  readonly getSurfaceBgColor = getSurfaceBgColor;
}
