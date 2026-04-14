import { Component, inject, signal, computed, OnInit, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationService } from '@core/services/navigation.service';
import { ToastService } from '@ui/components/toast/toast.service';
import { CharacterService } from '@core/services/character.service';
import { RaceService } from '@core/services/race.service';
import { gradeColor } from '@ui/utils/color-mapper';
import { Race, Umamusume } from '@shared/types';

/** 馬場フィルターの選択肢 */
type SurfaceFilter = 'all' | 'turf' | 'dirt';
/** 距離フィルターの選択肢 */
type DistanceFilter = 'all' | 'sprint' | 'mile' | 'classic' | 'long';

@Component({
  selector: 'app-race-cancel',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
         style="background-image: url('/image/backgroundFile/remaining-race-list.png')"></div>

    <div class="flex flex-col lg:flex-row h-screen overflow-hidden">

      <!-- 左パネル: ウマ娘情報 -->
      <div class="w-full lg:w-80 flex-shrink-0 flex flex-col items-center py-3 lg:py-4 px-4 gap-2 lg:gap-3 bg-black/40 overflow-y-auto max-h-[38vh] lg:max-h-none">

        <!-- スマホ: 画像(左) + 適性(右) の横並び / PC: 縦並び -->
        <div class="flex flex-row lg:flex-col gap-2 w-full items-start">

          <!-- ウマ娘画像 -->
          <div class="flex-shrink-0 p-1.5 lg:p-2 bg-gradient-to-b from-green-400 to-green-100 rounded-xl shadow-lg">
            <div
              class="w-24 h-24 lg:w-64 lg:h-64 rounded-lg bg-gray-200 bg-cover bg-center bg-no-repeat"
              [style.background-image]="umamusume()
                ? 'url(/image/umamusumeData/' + umamusume()!.umamusume_name + '.png)'
                : 'none'"
            ></div>
          </div>

          <!-- 適性情報 -->
          <div class="flex-1 bg-white/80 rounded-lg p-2 lg:p-3 space-y-1.5 lg:space-y-2">

            <!-- ウマ娘名 -->
            <div class="text-center font-black text-pink-600 text-sm lg:text-base truncate">
              {{ umamusume()?.umamusume_name ?? '読み込み中...' }}
            </div>

            <!-- バ場適性 -->
            <div class="flex items-stretch gap-1.5">
              <div class="text-xs font-bold text-gray-500 w-10 flex-shrink-0 flex items-center">バ場</div>
              <div class="flex gap-1 flex-1">
                <div class="flex items-center justify-between px-2 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200">
                  <span class="text-xs font-semibold text-gray-700">芝</span>
                  <span class="text-sm font-black ml-1" [class]="gradeColor(umamusume()?.turf_aptitude ?? '')">{{ umamusume()?.turf_aptitude || '-' }}</span>
                </div>
                <div class="flex items-center justify-between px-2 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200">
                  <span class="text-xs font-semibold text-gray-700">ダート</span>
                  <span class="text-sm font-black ml-1" [class]="gradeColor(umamusume()?.dirt_aptitude ?? '')">{{ umamusume()?.dirt_aptitude || '-' }}</span>
                </div>
              </div>
            </div>

            <!-- 距離適性 -->
            <div class="flex items-stretch gap-1.5">
              <div class="text-xs font-bold text-gray-500 w-10 flex-shrink-0 flex items-center">距離</div>
              <div class="flex gap-1 flex-1">
                <div class="flex flex-col items-center px-1 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200 gap-0.5">
                  <span class="text-xs font-semibold text-gray-600">短</span>
                  <span class="text-sm font-black" [class]="gradeColor(umamusume()?.sprint_aptitude ?? '')">{{ umamusume()?.sprint_aptitude || '-' }}</span>
                </div>
                <div class="flex flex-col items-center px-1 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200 gap-0.5">
                  <span class="text-xs font-semibold text-gray-600">マイ</span>
                  <span class="text-sm font-black" [class]="gradeColor(umamusume()?.mile_aptitude ?? '')">{{ umamusume()?.mile_aptitude || '-' }}</span>
                </div>
                <div class="flex flex-col items-center px-1 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200 gap-0.5">
                  <span class="text-xs font-semibold text-gray-600">中</span>
                  <span class="text-sm font-black" [class]="gradeColor(umamusume()?.classic_aptitude ?? '')">{{ umamusume()?.classic_aptitude || '-' }}</span>
                </div>
                <div class="flex flex-col items-center px-1 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200 gap-0.5">
                  <span class="text-xs font-semibold text-gray-600">長</span>
                  <span class="text-sm font-black" [class]="gradeColor(umamusume()?.long_distance_aptitude ?? '')">{{ umamusume()?.long_distance_aptitude || '-' }}</span>
                </div>
              </div>
            </div>

            <!-- 脚質適性 -->
            <div class="flex items-stretch gap-1.5">
              <div class="text-xs font-bold text-gray-500 w-10 flex-shrink-0 flex items-center">脚質</div>
              <div class="flex gap-1 flex-1">
                <div class="flex flex-col items-center px-1 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200 gap-0.5">
                  <span class="text-xs font-semibold text-gray-600">逃げ</span>
                  <span class="text-sm font-black" [class]="gradeColor(umamusume()?.front_runner_aptitude ?? '')">{{ umamusume()?.front_runner_aptitude || '-' }}</span>
                </div>
                <div class="flex flex-col items-center px-1 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200 gap-0.5">
                  <span class="text-xs font-semibold text-gray-600">先行</span>
                  <span class="text-sm font-black" [class]="gradeColor(umamusume()?.early_foot_aptitude ?? '')">{{ umamusume()?.early_foot_aptitude || '-' }}</span>
                </div>
                <div class="flex flex-col items-center px-1 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200 gap-0.5">
                  <span class="text-xs font-semibold text-gray-600">差し</span>
                  <span class="text-sm font-black" [class]="gradeColor(umamusume()?.midfield_aptitude ?? '')">{{ umamusume()?.midfield_aptitude || '-' }}</span>
                </div>
                <div class="flex flex-col items-center px-1 py-1 rounded-lg flex-1 bg-gray-100 border border-gray-200 gap-0.5">
                  <span class="text-xs font-semibold text-gray-600">追込</span>
                  <span class="text-sm font-black" [class]="gradeColor(umamusume()?.closer_aptitude ?? '')">{{ umamusume()?.closer_aptitude || '-' }}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- 右パネル: 出走済みレース -->
      <div class="flex-1 flex flex-col overflow-hidden min-h-0">

        <!-- 検索・フィルターバー -->
        <div class="flex-shrink-0 flex flex-col gap-2 px-4 pt-3 pb-2 bg-black/40">

          <!-- レース名検索 -->
          <input
            type="text"
            class="w-full bg-white/90 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400"
            placeholder="レース名で検索"
            [ngModel]="searchText()"
            (ngModelChange)="searchText.set($event)"
          />

          <!-- フィルターボタン -->
          <div class="flex flex-wrap gap-2">
            <!-- 馬場 -->
            <div class="flex gap-1">
              @for (s of surfaceOptions; track s.value) {
                <button
                  class="px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer"
                  [class]="surfaceFilter() === s.value
                    ? 'bg-white text-gray-800 shadow'
                    : 'bg-white/30 text-white hover:bg-white/50'"
                  (click)="surfaceFilter.set(s.value)"
                >{{ s.label }}</button>
              }
            </div>
            <!-- 距離 -->
            <div class="flex gap-1">
              @for (d of distanceOptions; track d.value) {
                <button
                  class="px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer"
                  [class]="distanceFilter() === d.value
                    ? 'bg-white text-gray-800 shadow'
                    : 'bg-white/30 text-white hover:bg-white/50'"
                  (click)="distanceFilter.set(d.value)"
                >{{ d.label }}</button>
              }
            </div>
          </div>
        </div>

        <!-- レースグリッド -->
        <div class="flex-1 overflow-y-auto no-scrollbar px-2 py-2 bg-black/20 min-h-0">
          @if (loading()) {
            <div class="flex justify-center items-center h-32">
              <p class="text-gray-300 text-lg">読み込み中...</p>
            </div>
          } @else if (filteredRaces().length === 0) {
            <div class="flex justify-center items-center h-32">
              <p class="text-gray-300 text-sm">該当するレースがありません</p>
            </div>
          } @else {
            <div class="grid grid-cols-4 gap-2">
              @for (race of filteredRaces(); track race.race_id) {
                <div
                  class="relative cursor-pointer rounded-xl overflow-hidden shadow-md
                         transition-all duration-150 hover:scale-105 hover:shadow-xl border-2 flex flex-col"
                  [class]="race.selected
                    ? 'border-red-400 bg-red-900/60'
                    : 'border-white/20 bg-black/50'"
                  (click)="toggleRace(race.race_id)"
                >
                  <!-- グレードバッジ -->
                  <div class="absolute top-1 left-1 text-xs font-black px-1.5 py-0.5 rounded shadow"
                       [class]="raceRankBadgeClass(race.race_rank)">
                    {{ raceRankLabel(race.race_rank) }}
                  </div>

                  <!-- レース画像 -->
                  <div class="flex-1 flex items-center justify-center overflow-hidden pt-5">
                    <img
                      [src]="'/image/raceData/' + race.race_name + '.png'"
                      [alt]="race.race_name"
                      class="w-full h-full object-contain transition-all duration-200"
                      [class]="race.selected ? 'opacity-100' : 'opacity-60'"
                    />
                  </div>

                  <!-- 取消マーク -->
                  @if (race.selected) {
                    <div class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5
                                 flex items-center justify-center text-xs font-bold shadow">
                      ✕
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- 下部ボタンエリア -->
        <div class="flex-shrink-0 flex items-center justify-between gap-4 py-3 px-6 bg-black/30">
          <span class="text-white text-sm">
            {{ selectedCount() > 0 ? selectedCount() + ' 件選択中' : '' }}
          </span>
          <div class="flex gap-3">
            <button
              class="bg-white/20 text-white py-2 px-5 rounded-lg font-semibold text-sm
                     hover:bg-white/30 transition-colors cursor-pointer"
              (click)="goBack()"
            >
              戻る
            </button>
            <button
              class="py-2 px-6 rounded-lg font-semibold text-sm transition-all"
              [class]="selectedCount() > 0
                ? 'bg-red-500 text-white hover:bg-red-600 cursor-pointer'
                : 'bg-gray-500/50 text-gray-400 cursor-not-allowed'"
              [disabled]="selectedCount() === 0"
              (click)="cancelRaces()"
            >
              取消実行
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
/** 出走済みレースの取り消しを行うコンポーネント */
export class RaceCancelComponent implements OnInit {
  private readonly characterService = inject(CharacterService);
  private readonly raceService = inject(RaceService);
  private readonly navService = inject(NavigationService);
  private readonly toastService = inject(ToastService);

  /** 対象ウマ娘ID（残レース一覧から渡される） */
  @Input() umamusumeId = 0;

  readonly gradeColor = gradeColor;

  /** 表示対象のウマ娘情報 */
  umamusume = signal<Umamusume | null>(null);
  /** 出走済みレース（選択フラグ付き） */
  runRaces = signal<(Race & { selected: boolean })[]>([]);
  /** 読み込み中フラグ */
  loading = signal(true);
  /** レース名検索テキスト */
  searchText = signal('');
  /** 馬場フィルター */
  surfaceFilter = signal<SurfaceFilter>('all');
  /** 距離フィルター */
  distanceFilter = signal<DistanceFilter>('all');

  readonly surfaceOptions: { label: string; value: SurfaceFilter }[] = [
    { label: '全て', value: 'all' },
    { label: '芝', value: 'turf' },
    { label: 'ダート', value: 'dirt' },
  ];

  readonly distanceOptions: { label: string; value: DistanceFilter }[] = [
    { label: '全て', value: 'all' },
    { label: '短距離', value: 'sprint' },
    { label: 'マイル', value: 'mile' },
    { label: '中距離', value: 'classic' },
    { label: '長距離', value: 'long' },
  ];

  /** 検索・フィルター適用後のレース一覧 */
  filteredRaces = computed(() => {
    const text = this.searchText().toLowerCase();
    const surface = this.surfaceFilter();
    const distance = this.distanceFilter();

    return this.runRaces().filter((r) => {
      if (text && !r.race_name.toLowerCase().includes(text)) return false;
      if (surface === 'turf' && r.race_state !== 0) return false;
      if (surface === 'dirt' && r.race_state !== 1) return false;
      if (distance === 'sprint' && r.distance !== 1) return false;
      if (distance === 'mile' && r.distance !== 2) return false;
      if (distance === 'classic' && r.distance !== 3) return false;
      if (distance === 'long' && r.distance !== 4) return false;
      return true;
    });
  });

  /** 取り消し選択中のレース数 */
  selectedCount = computed(() =>
    this.runRaces().filter((r) => r.selected).length,
  );

  /** コンポーネント初期化時にウマ娘情報と出走済みレースを取得する */
  ngOnInit() {
    this.fetchUmamusume();
    this.fetchRunRaces();
  }

  /** レースカードクリック時に取り消し選択状態をトグルする */
  toggleRace(raceId: number) {
    this.runRaces.update((races) =>
      races.map((r) => (r.race_id === raceId ? { ...r, selected: !r.selected } : r)),
    );
  }

  /** 選択中のレースの出走を取り消す */
  cancelRaces() {
    const raceIds = this.runRaces()
      .filter((r) => r.selected)
      .map((r) => r.race_id);
    if (raceIds.length === 0) return;

    this.raceService.cancelRunRaces(this.umamusumeId, raceIds).subscribe({
      next: () => {
        this.toastService.show(`${raceIds.length} 件の出走を取り消しました`);
        this.goBack();
      },
      error: () => {
        this.toastService.show('出走取り消しに失敗しました', 'error');
      },
    });
  }

  /** 残レース一覧に戻る */
  goBack() {
    this.navService.navigate({ page: 'remaining-race' });
  }

  /** グレードに対応するバッジのCSSクラスを返す */
  raceRankBadgeClass(rank: number): string {
    switch (rank) {
      case 1: return 'bg-yellow-400 text-gray-900';
      case 2: return 'bg-gray-300 text-gray-900';
      case 3: return 'bg-amber-600 text-white';
      default: return 'bg-gray-500 text-white';
    }
  }

  /** グレードに対応するラベルを返す */
  raceRankLabel(rank: number): string {
    switch (rank) {
      case 1: return 'G1';
      case 2: return 'G2';
      case 3: return 'G3';
      default: return '';
    }
  }

  /** 登録済みウマ娘一覧からumamusumeIdに一致するウマ娘を取得する */
  private fetchUmamusume() {
    this.characterService.getRegisteredUmamusumes().subscribe({
      next: (data) => {
        const found = data.find((r) => r.umamusume.umamusume_id === this.umamusumeId);
        this.umamusume.set(found?.umamusume ?? null);
      },
      error: (err) => console.error('Failed to fetch umamusume:', err),
    });
  }

  /** 出走済みレース一覧をAPIから取得する */
  private fetchRunRaces() {
    this.loading.set(true);
    this.raceService.getRunRaces(this.umamusumeId).subscribe({
      next: (data) => {
        this.runRaces.set(data.map((r) => ({ ...r, selected: false })));
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch run races:', err);
        this.loading.set(false);
      },
    });
  }
}
