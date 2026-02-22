import { Component, inject, signal, OnInit } from '@angular/core';
import { RemainingRace } from '@shared/types';
import { NavigationService } from '@core/services/navigation.service';
import { RaceService } from '@core/services/race.service';
import { getRaceCountClass, getRaceCountDisplay } from '@ui/utils/color-mapper';

@Component({
  selector: 'app-remaining-race-list',
  standalone: true,
  template: `
    <div class="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
         style="background-image: url('/image/backgroundFile/remaining-race-list.png')"></div>
    <div class="min-h-screen p-6">
    @if (loading()) {
      <div class="min-h-full flex justify-center items-center">
        <p class="text-gray-300 text-xl">読み込み中...</p>
      </div>
    } @else {

      <!-- スマホ: カードグリッド (sm未満) -->
      <div class="sm:hidden grid grid-cols-2 gap-3">
        @for (r of remainingRaces(); track r.umamusume.umamusume_id) {
          <div
            class="cursor-pointer rounded-xl overflow-hidden shadow-md transition-all duration-150
                   hover:scale-105 hover:shadow-xl border-2 border-white/20 bg-black/50 flex flex-col"
            (click)="openDialog(r)"
          >
            <!-- ウマ娘画像 -->
            <div class="p-2">
              <div class="p-1.5 bg-gradient-to-b from-green-400 to-green-100 rounded-xl shadow-md">
                <div
                  class="w-full aspect-square rounded-lg bg-gray-200 bg-cover bg-center bg-no-repeat"
                  [style.background-image]="'url(/image/umamusumeData/' + r.umamusume.umamusume_name + '.png)'"
                ></div>
              </div>
            </div>
            <!-- ウマ娘名 + 残レース数 -->
            <div class="flex flex-col items-center py-1.5 px-2 bg-black/60 gap-0.5">
              <span class="text-pink-300 text-xs font-semibold truncate w-full text-center">
                {{ r.umamusume.umamusume_name }}
              </span>
              @if (r.isAllCrown) {
                <span class="text-yellow-400 text-xs font-bold">全冠</span>
              } @else {
                <span class="text-white text-xs">残 <span [class]="getRaceCountClass(r.allCrownRace)">{{ getRaceCountDisplay(r.allCrownRace) }}</span> レース</span>
              }
            </div>
          </div>
        }
      </div>

      <!-- PC: テーブル (sm以上) -->
      <div class="hidden sm:block overflow-x-auto bg-black/30 backdrop-blur-sm rounded-xl shadow-lg border border-white/20">
        <table class="table-auto w-full min-w-[640px] border-collapse">
          <!-- ヘッダー -->
          <thead class="sticky top-0">
            <tr>
              <th class="border border-white/20 px-2 py-2 bg-black/60 text-white">処理</th>
              <th colspan="2" class="border border-white/20 px-2 py-2 bg-black/60 text-white">情報</th>
              <th colspan="4" class="border border-white/20 px-2 py-2 bg-green-500 text-white">芝</th>
              <th colspan="3" class="border border-white/20 px-2 py-2 bg-red-500 text-white">ダート</th>
            </tr>
            <tr>
              <th class="border border-white/20 px-2 py-2 w-20 bg-black/50 text-white">パターン</th>
              <th class="border border-white/20 px-2 py-2 w-24 bg-black/50 text-white">ウマ娘</th>
              <th class="border border-white/20 px-2 py-2 w-16 bg-black/50 text-white">総数</th>
              <th class="border border-white/20 px-2 py-2 w-16 bg-green-600/70 text-white">短距離</th>
              <th class="border border-white/20 px-2 py-2 w-16 bg-green-600/70 text-white">マイル</th>
              <th class="border border-white/20 px-2 py-2 w-16 bg-green-600/70 text-white">中距離</th>
              <th class="border border-white/20 px-2 py-2 w-16 bg-green-600/70 text-white">長距離</th>
              <th class="border border-white/20 px-2 py-2 w-16 bg-red-600/70 text-white">短距離</th>
              <th class="border border-white/20 px-2 py-2 w-16 bg-red-600/70 text-white">マイル</th>
              <th class="border border-white/20 px-2 py-2 w-16 bg-red-600/70 text-white">中距離</th>
            </tr>
          </thead>
          <tbody>
            @for (r of remainingRaces(); track r.umamusume.umamusume_id) {
              <tr class="hover:bg-white/10">
                <!-- パターンボタン -->
                <td class="border border-white/20 px-1 py-2 text-center">
                  @if (r.isAllCrown) {
                    <span class="font-bold text-yellow-400">全冠</span>
                  } @else {
                    <button
                      class="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-400 cursor-pointer"
                      (click)="openPattern(r)"
                    >パターン</button>
                  }
                </td>
                <!-- ウマ娘名 + 画像 -->
                <td class="border border-white/20 px-1 py-2 text-center">
                  <div class="p-1 bg-gradient-to-b from-green-400 to-green-100 rounded-lg shadow-md w-16 h-16 mx-auto mb-1">
                    <div
                      class="w-full h-full rounded-md bg-gray-100 bg-cover bg-center"
                      [style.background-image]="'url(/image/umamusumeData/' + r.umamusume.umamusume_name + '.png)'"
                    ></div>
                  </div>
                  <span class="text-pink-300 font-bold text-xs">{{ r.umamusume.umamusume_name }}</span>
                </td>
                <!-- 総数 -->
                <td class="border border-white/20 px-1 py-2 text-center">
                  <span [class]="getRaceCountClass(r.allCrownRace)">
                    {{ getRaceCountDisplay(r.allCrownRace) }}
                  </span>
                </td>
                <!-- 芝: 短距離/マイル/中距離/長距離 -->
                <td class="border border-white/20 px-1 py-2 text-center">
                  <span [class]="getRaceCountClass(r.turfSprintRace)">{{ getRaceCountDisplay(r.turfSprintRace) }}</span>
                </td>
                <td class="border border-white/20 px-1 py-2 text-center">
                  <span [class]="getRaceCountClass(r.turfMileRace)">{{ getRaceCountDisplay(r.turfMileRace) }}</span>
                </td>
                <td class="border border-white/20 px-1 py-2 text-center">
                  <span [class]="getRaceCountClass(r.turfClassicRace)">{{ getRaceCountDisplay(r.turfClassicRace) }}</span>
                </td>
                <td class="border border-white/20 px-1 py-2 text-center">
                  <span [class]="getRaceCountClass(r.turfLongDistanceRace)">{{ getRaceCountDisplay(r.turfLongDistanceRace) }}</span>
                </td>
                <!-- ダート: 短距離/マイル/中距離 -->
                <td class="border border-white/20 px-1 py-2 text-center">
                  <span [class]="getRaceCountClass(r.dirtSprintDistanceRace)">{{ getRaceCountDisplay(r.dirtSprintDistanceRace) }}</span>
                </td>
                <td class="border border-white/20 px-1 py-2 text-center">
                  <span [class]="getRaceCountClass(r.dirtMileRace)">{{ getRaceCountDisplay(r.dirtMileRace) }}</span>
                </td>
                <td class="border border-white/20 px-1 py-2 text-center">
                  <span [class]="getRaceCountClass(r.dirtClassicRace)">{{ getRaceCountDisplay(r.dirtClassicRace) }}</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
    </div>

    <!-- スマホ用 詳細ダイアログ -->
    @if (selectedRace()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        (click)="closeDialog()"
      >
        <div
          class="relative bg-white/95 rounded-2xl shadow-2xl p-5 w-80 mx-4 flex flex-col items-center gap-4"
          (click)="$event.stopPropagation()"
        >
          <!-- 閉じるボタン -->
          <button
            class="absolute top-3 right-3 text-gray-500 hover:text-gray-800 text-2xl font-bold
                   w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
            (click)="closeDialog()"
          >×</button>

          <!-- ウマ娘画像 -->
          <div class="p-2 bg-gradient-to-b from-green-400 to-green-100 rounded-xl shadow-lg">
            <div
              class="w-32 h-32 rounded-lg bg-gray-200 bg-cover bg-center bg-no-repeat"
              [style.background-image]="'url(/image/umamusumeData/' + selectedRace()!.umamusume.umamusume_name + '.png)'"
            ></div>
          </div>

          <!-- ウマ娘名 -->
          <h2 class="text-lg font-black text-gray-800">{{ selectedRace()!.umamusume.umamusume_name }}</h2>

          <!-- 残レース情報 -->
          <div class="w-full space-y-2 text-sm">
            <!-- 総数 -->
            <div class="flex items-center justify-between px-3 py-2 bg-gray-100 rounded-lg border border-gray-200">
              <span class="font-semibold text-gray-600">残レース総数</span>
              @if (selectedRace()!.isAllCrown) {
                <span class="font-bold text-yellow-500">全冠達成</span>
              } @else {
                <span [class]="getRaceCountClass(selectedRace()!.allCrownRace)" class="font-bold text-base">
                  {{ getRaceCountDisplay(selectedRace()!.allCrownRace) }}
                </span>
              }
            </div>

            <!-- 芝 -->
            <div class="rounded-lg border border-green-200 overflow-hidden">
              <div class="bg-green-500 text-white text-xs font-bold px-3 py-1">芝</div>
              <div class="grid grid-cols-4 divide-x divide-gray-200 bg-gray-50">
                @for (item of turfItems(); track item.label) {
                  <div class="flex flex-col items-center py-2 gap-0.5">
                    <span class="text-xs text-gray-500">{{ item.label }}</span>
                    <span [class]="getRaceCountClass(item.value)" class="font-bold text-sm">{{ getRaceCountDisplay(item.value) }}</span>
                  </div>
                }
              </div>
            </div>

            <!-- ダート -->
            <div class="rounded-lg border border-red-200 overflow-hidden">
              <div class="bg-red-500 text-white text-xs font-bold px-3 py-1">ダート</div>
              <div class="grid grid-cols-3 divide-x divide-gray-200 bg-gray-50">
                @for (item of dirtItems(); track item.label) {
                  <div class="flex flex-col items-center py-2 gap-0.5">
                    <span class="text-xs text-gray-500">{{ item.label }}</span>
                    <span [class]="getRaceCountClass(item.value)" class="font-bold text-sm">{{ getRaceCountDisplay(item.value) }}</span>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- パターンボタン -->
          @if (!selectedRace()!.isAllCrown) {
            <button
              class="w-full bg-blue-500 text-white py-2.5 px-4 rounded-xl font-bold hover:bg-blue-400 active:scale-95 transition-all cursor-pointer"
              (click)="openPatternFromDialog()"
            >パターンを見る</button>
          }
        </div>
      </div>
    }
  `,
})
/** 残レース一覧を表示するコンポーネント */
export class RemainingRaceListComponent implements OnInit {
  private readonly raceService = inject(RaceService);
  private readonly navService = inject(NavigationService);

  /** 残レース情報の一覧 */
  remainingRaces = signal<RemainingRace[]>([]);
  /** データ読み込み中フラグ */
  loading = signal(true);
  /** スマホ詳細ダイアログで表示中の残レース情報 */
  selectedRace = signal<RemainingRace | null>(null);

  /** コンポーネント初期化時に残レース情報を取得する */
  ngOnInit() {
    this.fetchRemainingRaces();
  }

  /** APIから残レース情報を取得してシグナルにセットする */
  private fetchRemainingRaces() {
    this.loading.set(true);
    this.raceService.getRemainingRaces().subscribe({
      next: (data) => {
        this.remainingRaces.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch remaining races:', err);
        this.loading.set(false);
      },
    });
  }

  /** スマホ用詳細ダイアログを開く */
  openDialog(r: RemainingRace) {
    this.selectedRace.set(r);
  }

  /** スマホ用詳細ダイアログを閉じる */
  closeDialog() {
    this.selectedRace.set(null);
  }

  /** ダイアログからパターン画面に遷移する */
  openPatternFromDialog() {
    const r = this.selectedRace();
    if (r) {
      this.closeDialog();
      this.openPattern(r);
    }
  }

  /** パターン画面に遷移する */
  openPattern(r: RemainingRace) {
    this.navService.navigate({ page: 'remaining-race-pattern', umamusumeId: r.umamusume.umamusume_id });
  }

  /** 芝の距離別残レース項目 */
  turfItems() {
    const r = this.selectedRace();
    if (!r) return [];
    return [
      { label: '短距離', value: r.turfSprintRace },
      { label: 'マイル', value: r.turfMileRace },
      { label: '中距離', value: r.turfClassicRace },
      { label: '長距離', value: r.turfLongDistanceRace },
    ];
  }

  /** ダートの距離別残レース項目 */
  dirtItems() {
    const r = this.selectedRace();
    if (!r) return [];
    return [
      { label: '短距離', value: r.dirtSprintDistanceRace },
      { label: 'マイル', value: r.dirtMileRace },
      { label: '中距離', value: r.dirtClassicRace },
    ];
  }

  readonly getRaceCountClass = getRaceCountClass;
  readonly getRaceCountDisplay = getRaceCountDisplay;
}
