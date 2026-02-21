import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { RegistUmamusume, Umamusume } from '@shared/types';

@Component({
  selector: 'app-character-list',
  standalone: true,
  imports: [],
  template: `
    <div class="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
         style="background-image: url('/image/backgroundFile/character-list.png')"></div>
    <div class="min-h-screen p-6">
      @if (loading()) {
        <div class="flex justify-center items-center h-64">
          <p class="text-gray-500 text-xl">読み込み中...</p>
        </div>
      } @else {
        <!-- 4列グリッド -->
        <div class="grid grid-cols-4 gap-4">
          @for (reg of registUmamusumes(); track reg.umamusume.umamusume_id) {
            <div
              class="cursor-pointer rounded-xl overflow-hidden shadow-md transition-all duration-150
                     hover:scale-105 hover:shadow-xl border-2 border-white/20 bg-black/50 flex flex-col"
              (click)="openDialog(reg.umamusume)"
            >
              <!-- ウマ娘画像 -->
              <div class="p-2">
                <div class="p-1.5 bg-gradient-to-b from-green-400 to-green-100 rounded-xl shadow-md">
                  <div
                    class="w-full aspect-square rounded-lg bg-gray-200 bg-cover bg-center bg-no-repeat"
                    [style.background-image]="'url(/image/umamusumeData/' + reg.umamusume.umamusume_name + '.png)'"
                  ></div>
                </div>
              </div>
              <!-- ウマ娘名 -->
              <div class="text-white text-sm text-center font-semibold py-1.5 px-2 bg-black/60 truncate">
                {{ reg.umamusume.umamusume_name }}
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- 詳細ダイアログ (オーバーレイ) -->
    @if (selectedUmamusume()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        (click)="closeDialog()"
      >
        <div
          class="relative bg-white/95 rounded-2xl shadow-2xl p-6 w-96 mx-4 flex flex-col items-center gap-4"
          (click)="$event.stopPropagation()"
        >
          <!-- 閉じるボタン -->
          <button
            class="absolute top-3 right-3 text-gray-500 hover:text-gray-800 text-2xl font-bold
                   w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
            (click)="closeDialog()"
          >
            ×
          </button>

          <!-- ウマ娘画像 -->
          <div class="p-2 bg-gradient-to-b from-green-400 to-green-100 rounded-xl shadow-lg">
            <div
              class="w-40 h-40 rounded-lg bg-gray-200 bg-cover bg-center bg-no-repeat"
              [style.background-image]="'url(/image/umamusumeData/' + selectedUmamusume()!.umamusume_name + '.png)'"
            ></div>
          </div>

          <!-- ウマ娘名 -->
          <h2 class="text-xl font-black text-gray-800">{{ selectedUmamusume()!.umamusume_name }}</h2>

          <!-- 適性情報 -->
          <div class="w-full space-y-2">

            <!-- バ場適性 -->
            <div class="flex items-stretch gap-2">
              <div class="text-xs font-bold text-gray-500 w-14 flex-shrink-0 flex items-center">バ場適性</div>
              <div class="flex gap-2 flex-1">
                @for (item of trackAptitudes(); track item.name) {
                  <div class="flex items-center justify-between px-3 py-1.5 rounded-lg flex-1 bg-gray-100 border border-gray-200">
                    <span class="text-sm font-semibold text-gray-700">{{ item.name }}</span>
                    <span class="text-lg font-black ml-2" [class]="gradeColor(item.value)">{{ item.value }}</span>
                  </div>
                }
              </div>
            </div>

            <!-- 距離適性 -->
            <div class="flex items-stretch gap-2">
              <div class="text-xs font-bold text-gray-500 w-14 flex-shrink-0 flex items-center">距離適性</div>
              <div class="flex gap-1 flex-1">
                @for (item of distanceAptitudes(); track item.name) {
                  <div class="flex flex-col items-center px-1.5 py-1.5 rounded-lg flex-1 bg-gray-100 border border-gray-200 gap-0.5">
                    <span class="text-xs font-semibold text-gray-600">{{ item.name }}</span>
                    <span class="text-base font-black" [class]="gradeColor(item.value)">{{ item.value }}</span>
                  </div>
                }
              </div>
            </div>

            <!-- 脚質 -->
            <div class="flex items-stretch gap-2">
              <div class="text-xs font-bold text-gray-500 w-14 flex-shrink-0 flex items-center">脚質</div>
              <div class="flex gap-1 flex-1">
                @for (item of tacticAptitudes(); track item.name) {
                  <div class="flex flex-col items-center px-1.5 py-1.5 rounded-lg flex-1 bg-gray-100 border border-gray-200 gap-0.5">
                    <span class="text-xs font-semibold text-gray-600">{{ item.name }}</span>
                    <span class="text-base font-black" [class]="gradeColor(item.value)">{{ item.value }}</span>
                  </div>
                }
              </div>
            </div>

          </div>
        </div>
      </div>
    }
  `,
})
/** 登録済みウマ娘の一覧をグリッド表示し、クリックで適性詳細を表示するコンポーネント */
export class CharacterListComponent implements OnInit {
  private readonly http = inject(HttpClient);

  /** 登録済みウマ娘の一覧 */
  registUmamusumes = signal<RegistUmamusume[]>([]);
  /** 読み込み中フラグ */
  loading = signal(true);
  /** 詳細ダイアログで表示中のウマ娘 */
  selectedUmamusume = signal<Umamusume | null>(null);

  /** バ場適性アイテム */
  trackAptitudes = computed(() => {
    const uma = this.selectedUmamusume();
    if (!uma) return [];
    return [
      { name: '芝', value: uma.turf_aptitude },
      { name: 'ダート', value: uma.dirt_aptitude },
    ];
  });

  /** 距離適性アイテム */
  distanceAptitudes = computed(() => {
    const uma = this.selectedUmamusume();
    if (!uma) return [];
    return [
      { name: '短距離', value: uma.sprint_aptitude },
      { name: 'マイル', value: uma.mile_aptitude },
      { name: '中距離', value: uma.classic_aptitude },
      { name: '長距離', value: uma.long_distance_aptitude },
    ];
  });

  /** 脚質適性アイテム */
  tacticAptitudes = computed(() => {
    const uma = this.selectedUmamusume();
    if (!uma) return [];
    return [
      { name: '逃げ', value: uma.front_runner_aptitude },
      { name: '先行', value: uma.early_foot_aptitude },
      { name: '差し', value: uma.midfield_aptitude },
      { name: '追込', value: uma.closer_aptitude },
    ];
  });

  /** コンポーネント初期化時にウマ娘一覧を取得する */
  ngOnInit() {
    this.fetchUmamusumes();
  }

  /** ウマ娘カードクリック時に詳細ダイアログを開く */
  openDialog(umamusume: Umamusume) {
    this.selectedUmamusume.set(umamusume);
  }

  /** 詳細ダイアログを閉じる */
  closeDialog() {
    this.selectedUmamusume.set(null);
  }

  /** 適性ランクに対応するテキスト色クラスを返す */
  gradeColor(grade: string): string {
    switch (grade) {
      case 'S': return 'text-amber-500';
      case 'A': return 'text-rose-500';
      case 'B': return 'text-orange-400';
      case 'C': return 'text-lime-500';
      case 'D': return 'text-cyan-500';
      case 'E': return 'text-indigo-400';
      case 'F': return 'text-slate-500';
      case 'G': return 'text-gray-400';
      default:  return 'text-gray-300';
    }
  }

  /** APIから登録済みウマ娘一覧を取得する */
  private fetchUmamusumes() {
    this.loading.set(true);
    this.http
      .get<RegistUmamusume[]>(`${environment.apiUrl}/umamusumes/registered`)
      .subscribe({
        next: (data) => {
          this.registUmamusumes.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to fetch registered umamusumes:', err);
          this.loading.set(false);
        },
      });
  }
}