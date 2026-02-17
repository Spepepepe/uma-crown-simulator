import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../../shared/components/toast/toast.service';
import { environment } from '../../environments/environment';
import { RacePattern, RaceSlot, Umamusume } from '@shared/types';

type CategoryKey = 'junior' | 'classic' | 'senior';

interface PatternData {
  scenario: string;
  strategy: Record<string, number>;
  surface: string;
  distance: string;
  junior: RaceSlot[];
  classic: RaceSlot[];
  senior: RaceSlot[];
  factors: string[];
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
export class RemainingRacePatternComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  private umamusumeId = 0;

  patterns = signal<PatternData[]>([]);
  umamusumeName = signal('');
  selectedPattern = signal(0);
  selectedCategory = signal<CategoryKey>('junior');

  categories: { key: CategoryKey; label: string }[] = [
    { key: 'junior', label: 'ジュニア期' },
    { key: 'classic', label: 'クラシック期' },
    { key: 'senior', label: 'シニア期' },
  ];

  ngOnInit() {
    this.umamusumeId = Number(this.route.snapshot.paramMap.get('id'));
    this.fetchPattern();
  }

  currentPattern(): PatternData | null {
    const p = this.patterns();
    const idx = this.selectedPattern();
    return p[idx] ?? null;
  }

  currentRaces(): RaceSlot[] {
    const p = this.currentPattern();
    if (!p) return [];
    return p[this.selectedCategory()] ?? [];
  }

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

  goBack() {
    this.router.navigate(['/remaining-race']);
  }

  onImageError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  getDistanceLabel(d: number): string {
    switch (d) {
      case 1: return '短距離';
      case 2: return 'マイル';
      case 3: return '中距離';
      case 4: return '長距離';
      default: return '';
    }
  }

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
