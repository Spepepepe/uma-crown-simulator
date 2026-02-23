import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationService } from '@core/services/navigation.service';
import { gradeColor } from '@ui/utils/color-mapper';
import { ToastService } from '@ui/components/toast/toast.service';
import { Umamusume, Race, RaceTab } from '@shared/types';
import { CharacterService } from '@core/services/character.service';
import { RaceService } from '@core/services/race.service';

/** 1ページあたりの表示レース数（5行 × 3列） */
const PAGE_SIZE = 15;

@Component({
  selector: 'app-character-regist',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
         style="background-image: url('/image/backgroundFile/character-regist.png')"></div>

    <div class="flex flex-col md:flex-row h-screen overflow-hidden">

      <!-- 左パネル: 選択・画像・適性 -->
      <div class="w-full md:w-80 flex-shrink-0 flex flex-col items-center py-3 md:py-4 px-4 gap-2 md:gap-3 bg-black/40 overflow-y-auto max-h-[38vh] md:max-h-none">

        <!-- 選択ドロップダウン -->
        <select
          class="w-full bg-green-200 border border-gray-300 rounded-lg p-2 text-pink-500 text-sm
                 transition-all duration-300 hover:shadow-md cursor-pointer"
          [ngModel]="selectedUmamusumeId()"
          (ngModelChange)="onSelectUmamusume($event)"
        >
          <option [ngValue]="null">ウマ娘を選択</option>
          @for (u of umamusumes(); track u.umamusume_id) {
            <option [ngValue]="u.umamusume_id">{{ u.umamusume_name }}</option>
          }
        </select>

        <!-- スマホ: 画像(左) + 適性(右) の横並び / PC: 縦並び -->
        <div class="flex flex-row md:flex-col gap-2 w-full items-start">

          <!-- ウマ娘画像 -->
          <div class="flex-shrink-0 p-1.5 md:p-2 bg-gradient-to-b from-green-400 to-green-100 rounded-xl shadow-lg">
            <div
              class="w-24 h-24 md:w-64 md:h-64 rounded-lg bg-gray-200 bg-cover bg-center bg-no-repeat"
              [style.background-image]="selectedUmamusume()
                ? 'url(/image/umamusumeData/' + selectedUmamusume()!.umamusume_name + '.png)'
                : 'none'"
            ></div>
          </div>

          <!-- 適性情報（ダイアログと同スタイル: ラベル + 横並び値） -->
          <div class="flex-1 bg-white/80 rounded-lg p-2 md:p-3 space-y-1.5 md:space-y-2">

            <!-- バ場適性 -->
            <div class="flex items-stretch gap-1.5">
              <div class="text-xs font-bold text-gray-500 w-10 flex-shrink-0 flex items-center">バ場</div>
              <div class="flex gap-1 flex-1">
                <div class="flex items-center justify-between px-2 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200">
                  <span class="text-xs font-semibold text-gray-700">芝</span>
                  <span class="text-sm font-black ml-1" [class]="gradeColor(selectedUmamusume()?.turf_aptitude ?? '')">{{ selectedUmamusume()?.turf_aptitude || '-' }}</span>
                </div>
                <div class="flex items-center justify-between px-2 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200">
                  <span class="text-xs font-semibold text-gray-700">ダート</span>
                  <span class="text-sm font-black ml-1" [class]="gradeColor(selectedUmamusume()?.dirt_aptitude ?? '')">{{ selectedUmamusume()?.dirt_aptitude || '-' }}</span>
                </div>
              </div>
            </div>

            <!-- 距離適性 -->
            <div class="flex items-stretch gap-1.5">
              <div class="text-xs font-bold text-gray-500 w-10 flex-shrink-0 flex items-center">距離</div>
              <div class="flex gap-1 flex-1">
                <div class="flex flex-col items-center px-1 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200 gap-0.5">
                  <span class="text-xs font-semibold text-gray-600">短</span>
                  <span class="text-sm font-black" [class]="gradeColor(selectedUmamusume()?.sprint_aptitude ?? '')">{{ selectedUmamusume()?.sprint_aptitude || '-' }}</span>
                </div>
                <div class="flex flex-col items-center px-1 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200 gap-0.5">
                  <span class="text-xs font-semibold text-gray-600">マイ</span>
                  <span class="text-sm font-black" [class]="gradeColor(selectedUmamusume()?.mile_aptitude ?? '')">{{ selectedUmamusume()?.mile_aptitude || '-' }}</span>
                </div>
                <div class="flex flex-col items-center px-1 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200 gap-0.5">
                  <span class="text-xs font-semibold text-gray-600">中</span>
                  <span class="text-sm font-black" [class]="gradeColor(selectedUmamusume()?.classic_aptitude ?? '')">{{ selectedUmamusume()?.classic_aptitude || '-' }}</span>
                </div>
                <div class="flex flex-col items-center px-1 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200 gap-0.5">
                  <span class="text-xs font-semibold text-gray-600">長</span>
                  <span class="text-sm font-black" [class]="gradeColor(selectedUmamusume()?.long_distance_aptitude ?? '')">{{ selectedUmamusume()?.long_distance_aptitude || '-' }}</span>
                </div>
              </div>
            </div>

            <!-- 脚質適性 -->
            <div class="flex items-stretch gap-1.5">
              <div class="text-xs font-bold text-gray-500 w-10 flex-shrink-0 flex items-center">脚質</div>
              <div class="flex gap-1 flex-1">
                <div class="flex flex-col items-center px-1 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200 gap-0.5">
                  <span class="text-xs font-semibold text-gray-600">逃げ</span>
                  <span class="text-sm font-black" [class]="gradeColor(selectedUmamusume()?.front_runner_aptitude ?? '')">{{ selectedUmamusume()?.front_runner_aptitude || '-' }}</span>
                </div>
                <div class="flex flex-col items-center px-1 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200 gap-0.5">
                  <span class="text-xs font-semibold text-gray-600">先行</span>
                  <span class="text-sm font-black" [class]="gradeColor(selectedUmamusume()?.early_foot_aptitude ?? '')">{{ selectedUmamusume()?.early_foot_aptitude || '-' }}</span>
                </div>
                <div class="flex flex-col items-center px-1 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200 gap-0.5">
                  <span class="text-xs font-semibold text-gray-600">差し</span>
                  <span class="text-sm font-black" [class]="gradeColor(selectedUmamusume()?.midfield_aptitude ?? '')">{{ selectedUmamusume()?.midfield_aptitude || '-' }}</span>
                </div>
                <div class="flex flex-col items-center px-1 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200 gap-0.5">
                  <span class="text-xs font-semibold text-gray-600">追込</span>
                  <span class="text-sm font-black" [class]="gradeColor(selectedUmamusume()?.closer_aptitude ?? '')">{{ selectedUmamusume()?.closer_aptitude || '-' }}</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>

      <!-- 右パネル: タブ + レースグリッド + ボタン -->
      <div class="flex-1 flex flex-col overflow-hidden min-h-0">

        <!-- タブ -->
        <div class="flex gap-1 px-4 pt-3 flex-shrink-0">
          @for (tab of tabs; track tab) {
            <button
              class="px-5 py-2 rounded-t-lg font-bold text-sm transition-all duration-200"
              [class]="activeTab() === tab
                ? 'bg-green-500 text-white shadow-lg'
                : 'bg-white/60 text-gray-700 hover:bg-white/80'"
              (click)="onTabChange(tab)"
            >
              {{ tabLabel(tab) }}
              <span class="ml-1 text-xs opacity-80">({{ checkedCount(tab) }}/{{ totalCount(tab) }})</span>
            </button>
          }
        </div>

        <!-- レースグリッド + 矢印ナビ -->
        <div class="flex-1 flex items-stretch overflow-hidden px-1 py-2 bg-black/40 md:bg-black/20 min-h-0">

          <!-- 左矢印 -->
          <button
            class="flex-shrink-0 w-10 flex items-center justify-center text-white text-4xl font-bold
                   rounded-lg transition-all duration-200"
            [class]="canGoPrev()
              ? 'opacity-80 hover:opacity-100 hover:bg-white/20 cursor-pointer'
              : 'opacity-20 cursor-not-allowed'"
            [disabled]="!canGoPrev()"
            (click)="goPrev()"
          >
            ‹
          </button>

          <!-- レースグリッド 3列 × 5行 -->
          <div
            class="flex-1 grid grid-cols-3 gap-2 min-h-0 h-full"
            style="grid-template-rows: repeat(5, 1fr);"
          >
            @for (race of pagedRaces(); track race.race_id) {
              <div
                class="relative cursor-pointer rounded-xl overflow-hidden shadow-md
                       transition-all duration-150 hover:scale-105 hover:shadow-xl border-2 flex flex-col"
                [class]="race.checked
                  ? 'border-green-400 bg-green-900/60'
                  : 'border-white/20 bg-black/50'"
                (click)="toggleRace(race.race_id)"
              >
                <!-- レース画像 -->
                <div class="flex-1 flex items-center justify-center overflow-hidden">
                  <img
                    [src]="'/image/raceData/' + race.race_name + '.png'"
                    [alt]="race.race_name"
                    class="w-full h-full object-cover transition-all duration-200"
                    [class]="race.checked ? 'opacity-100' : 'opacity-50 grayscale'"
                  />
                </div>
                <!-- チェックマーク -->
                @if (race.checked) {
                  <div class="absolute top-1 right-1 bg-green-500 text-white rounded-full w-5 h-5
                               flex items-center justify-center text-xs font-bold shadow">
                    ✓
                  </div>
                }
              </div>
            }
            <!-- 空セルでグリッドを満たす -->
            @for (_ of emptySlots(); track $index) {
              <div></div>
            }
          </div>

          <!-- 右矢印 -->
          <button
            class="flex-shrink-0 w-10 flex items-center justify-center text-white text-4xl font-bold
                   rounded-lg transition-all duration-200"
            [class]="canGoNext()
              ? 'opacity-80 hover:opacity-100 hover:bg-white/20 cursor-pointer'
              : 'opacity-20 cursor-not-allowed'"
            [disabled]="!canGoNext()"
            (click)="goNext()"
          >
            ›
          </button>
        </div>

        <!-- ページドット + ボタンエリア -->
        <div class="flex-shrink-0 flex flex-col items-center gap-2 py-3 px-4 bg-black/30">
          <!-- ページインジケーター（ドット） -->
          <div class="flex gap-1.5">
            @for (p of pageIndicators(); track $index) {
              <span
                class="w-2 h-2 rounded-full transition-all duration-200"
                [class]="p === currentPage() ? 'bg-white scale-125' : 'bg-white/40'"
              ></span>
            }
          </div>
          <!-- ボタン -->
          <div class="flex gap-4">
            <button
              class="bg-green-500 text-white py-2 px-6 rounded-md shadow-md
                     hover:bg-green-600 cursor-pointer font-semibold transition-colors duration-200"
              (click)="selectAll()"
            >
              全出走
            </button>
            <button
              class="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white py-2 px-8
                     rounded-full shadow-lg hover:scale-105 transition-all duration-300
                     disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-semibold"
              [disabled]="!selectedUmamusume()"
              (click)="registerCharacter()"
            >
              登録
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
/** ウマ娘と出走済みレースを登録するコンポーネント */
export class CharacterRegistComponent implements OnInit {
  private readonly characterService = inject(CharacterService);
  private readonly raceService = inject(RaceService);
  private readonly navService = inject(NavigationService);
  private readonly toastService = inject(ToastService);

  readonly gradeColor = gradeColor;

  /** 未登録ウマ娘の一覧 */
  umamusumes = signal<Umamusume[]>([]);
  /** チェックボックス付きレース一覧 */
  races = signal<(Race & { checked: boolean })[]>([]);
  /** 選択中のウマ娘オブジェクト */
  selectedUmamusume = signal<Umamusume | null>(null);
  /** 選択中のウマ娘ID */
  selectedUmamusumeId = signal<number | null>(null);
  /** 現在表示中のタブ */
  activeTab = signal<RaceTab>('G1');
  /** 現在のページ番号（0始まり） */
  currentPage = signal<number>(0);

  readonly tabs: RaceTab[] = ['G1', 'G2', 'G3'];

  /** 現在タブのレース一覧 */
  filteredRaces = computed(() => {
    const rankMap: Record<RaceTab, number> = { G1: 1, G2: 2, G3: 3 };
    return this.races().filter((r) => r.race_rank === rankMap[this.activeTab()]);
  });

  /** 現在タブの総ページ数 */
  pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredRaces().length / PAGE_SIZE)),
  );

  /** 現在ページに表示するレース */
  pagedRaces = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return this.filteredRaces().slice(start, start + PAGE_SIZE);
  });

  /** グリッドを5×3に満たすための空スロット */
  emptySlots = computed(() => {
    const fill = PAGE_SIZE - this.pagedRaces().length;
    return fill > 0 ? Array(fill) : [];
  });

  /** ページドット用インデックス配列 */
  pageIndicators = computed(() =>
    Array.from({ length: this.pageCount() }, (_, i) => i),
  );

  /** 左矢印が有効かどうか */
  canGoPrev = computed(() => this.activeTab() !== 'G1' || this.currentPage() > 0);

  /** 右矢印が有効かどうか */
  canGoNext = computed(() => {
    const isLastTab = this.activeTab() === 'G3';
    const isLastPage = this.currentPage() >= this.pageCount() - 1;
    return !(isLastTab && isLastPage);
  });

  /** コンポーネント初期化時にウマ娘・レース一覧を取得する */
  ngOnInit() {
    this.fetchUmamusumes();
    this.fetchRaces();
  }

  /** タブ名を表示用ラベルに変換する */
  tabLabel(tab: RaceTab): string {
    switch (tab) {
      case 'G1': return 'G I';
      case 'G2': return 'G II';
      case 'G3': return 'G III';
    }
  }

  /** 指定タブの出走済みレース数を返す */
  checkedCount(tab: RaceTab): number {
    const rankMap: Record<RaceTab, number> = { G1: 1, G2: 2, G3: 3 };
    return this.races().filter((r) => r.race_rank === rankMap[tab] && r.checked).length;
  }

  /** 指定タブの総レース数を返す */
  totalCount(tab: RaceTab): number {
    const rankMap: Record<RaceTab, number> = { G1: 1, G2: 2, G3: 3 };
    return this.races().filter((r) => r.race_rank === rankMap[tab]).length;
  }

  /** タブ切り替え（ページを先頭にリセット） */
  onTabChange(tab: RaceTab) {
    this.activeTab.set(tab);
    this.currentPage.set(0);
  }

  /** 次のページへ。最終ページなら次タブの先頭へ */
  goNext() {
    if (this.currentPage() < this.pageCount() - 1) {
      this.currentPage.update((p) => p + 1);
    } else {
      const idx = this.tabs.indexOf(this.activeTab());
      if (idx < this.tabs.length - 1) {
        this.activeTab.set(this.tabs[idx + 1]);
        this.currentPage.set(0);
      }
    }
  }

  /** 前のページへ。先頭ページなら前タブの最終ページへ */
  goPrev() {
    if (this.currentPage() > 0) {
      this.currentPage.update((p) => p - 1);
    } else {
      const idx = this.tabs.indexOf(this.activeTab());
      if (idx > 0) {
        const prevTab = this.tabs[idx - 1];
        const rankMap: Record<RaceTab, number> = { G1: 1, G2: 2, G3: 3 };
        const prevRaces = this.races().filter((r) => r.race_rank === rankMap[prevTab]);
        const prevPageCount = Math.max(1, Math.ceil(prevRaces.length / PAGE_SIZE));
        this.activeTab.set(prevTab);
        this.currentPage.set(prevPageCount - 1);
      }
    }
  }

  /** 未登録ウマ娘一覧をAPIから取得する */
  private fetchUmamusumes() {
    this.characterService.getUnregisteredUmamusumes().subscribe({
      next: (data) => this.umamusumes.set(data),
      error: (err) => console.error('Failed to fetch umamusumes:', err),
    });
  }

  /** 登録用レース一覧（G1~G3）をAPIから取得する */
  private fetchRaces() {
    this.raceService.getRegistrationTargets().subscribe({
      next: (data) => this.races.set(data.map((r) => ({ ...r, checked: false }))),
      error: (err) => console.error('Failed to fetch races:', err),
    });
  }

  /** ウマ娘セレクトボックス変更時の処理 */
  onSelectUmamusume(id: number | null) {
    this.selectedUmamusumeId.set(id);
    if (id) {
      const uma = this.umamusumes().find((u) => u.umamusume_id === id) ?? null;
      this.selectedUmamusume.set(uma);
    } else {
      this.selectedUmamusume.set(null);
    }
  }

  /** レースカードクリック時に出走済み状態をトグルする */
  toggleRace(raceId: number) {
    this.races.update((races) =>
      races.map((r) => (r.race_id === raceId ? { ...r, checked: !r.checked } : r)),
    );
  }

  /** 全レースを出走済みにする */
  selectAll() {
    this.races.update((races) => races.map((r) => ({ ...r, checked: true })));
  }

  /** 選択中のウマ娘とチェックしたレースをAPIに登録する */
  registerCharacter() {
    const uma = this.selectedUmamusume();
    if (!uma) return;

    const raceIds = this.races()
      .filter((r) => r.checked)
      .map((r) => r.race_id);

    this.characterService.registerCharacter(uma.umamusume_id, raceIds).subscribe({
      next: () => {
        this.toastService.show('登録が完了しました', 'success');
        this.navService.navigate({ page: 'character-list' });
      },
      error: (err) => {
        console.error('Registration failed:', err);
        this.toastService.show('登録に失敗しました', 'error');
      },
    });
  }
}
