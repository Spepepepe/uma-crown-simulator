import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { Race } from '@shared/types';

@Component({
  selector: 'app-race-list',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
         style="background-image: url('/image/backgroundFile/race-list.png')"></div>
    <div class="min-h-screen p-6">
    @if (loading()) {
      <div class="min-h-full flex justify-center items-center">
        <p class="text-gray-500 text-xl">読み込み中...</p>
      </div>
    } @else {
      <div class="space-y-4">
        <!-- フィルタ -->
        <div class="flex gap-4">
          <div>
            <label class="font-semibold mr-2">馬場</label>
            <select [(ngModel)]="selectedState" (ngModelChange)="fetchRaces()" class="border rounded p-2">
              <option [ngValue]="-1">すべて</option>
              <option [ngValue]="0">芝</option>
              <option [ngValue]="1">ダート</option>
            </select>
          </div>
          <div>
            <label class="font-semibold mr-2">距離</label>
            <select [(ngModel)]="selectedDistance" (ngModelChange)="fetchRaces()" class="border rounded p-2">
              <option [ngValue]="-1">すべて</option>
              <option [ngValue]="1">短距離</option>
              <option [ngValue]="2">マイル</option>
              <option [ngValue]="3">中距離</option>
              <option [ngValue]="4">長距離</option>
            </select>
          </div>
        </div>

        <!-- レーステーブル -->
        <table class="table-auto w-full border-collapse border border-gray-300">
          <thead class="bg-gray-200 sticky top-0">
            <tr>
              <th class="border border-gray-500 px-4 py-2">レース名</th>
              <th class="border border-gray-500 px-4 py-2">クラス</th>
              <th class="border border-gray-500 px-4 py-2">馬場</th>
              <th class="border border-gray-500 px-4 py-2">距離</th>
              <th class="border border-gray-500 px-4 py-2">ファン数</th>
              <th class="border border-gray-500 px-4 py-2">出走時期</th>
              <th class="border border-gray-500 px-4 py-2">月</th>
            </tr>
          </thead>
          <tbody>
            @for (race of races(); track race.race_id) {
              <tr class="hover:bg-gray-50">
                <td class="border border-gray-500 px-4 py-2 text-center">{{ race.race_name }}</td>
                <td class="border border-gray-500 px-4 py-2 text-center">{{ getRaceRank(race.race_rank) }}</td>
                <td class="border border-gray-500 px-4 py-2 text-center">{{ race.race_state ? 'ダート' : '芝' }}</td>
                <td class="border border-gray-500 px-4 py-2 text-center">{{ getDistance(race.distance) }}/{{ race.distance_detail }}m</td>
                <td class="border border-gray-500 px-4 py-2 text-center">{{ race.num_fans }}</td>
                <td class="border border-gray-500 px-4 py-2 text-center">{{ getRunSeason(race) }}</td>
                <td class="border border-gray-500 px-4 py-2 text-center">{{ race.race_months }}月{{ race.half_flag ? '後半' : '前半' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
    </div>
  `,
})
/** 馬場・距離フィルタ付きのレース情報一覧を表示するコンポーネント */
export class RaceListComponent implements OnInit {
  private readonly http = inject(HttpClient);

  /** レース一覧 */
  races = signal<Race[]>([]);
  /** 読み込み中フラグ */
  loading = signal(true);
  /** 馬場フィルタ選択値（-1=全て） */
  selectedState = -1;
  /** 距離フィルタ選択値（-1=全て） */
  selectedDistance = -1;

  /** コンポーネント初期化時にレース一覧を取得する */
  ngOnInit() {
    this.fetchRaces();
  }

  /** フィルタ条件でレース一覧をAPIから取得する */
  fetchRaces() {
    this.loading.set(true);
    this.http
      .get<Race[]>(`${environment.apiUrl}/races`, {
        params: {
          state: this.selectedState.toString(),
          distance: this.selectedDistance.toString(),
        },
      })
      .subscribe({
        next: (data) => {
          this.races.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to fetch races:', err);
          this.loading.set(false);
        },
      });
  }

  /** レースランク番号をGI/GII/GIIIに変換する
   * @param rank - ランク番号（1~3）
   * @returns ランク文字列
   */
  getRaceRank(rank: number): string {
    switch (rank) {
      case 1: return 'GI';
      case 2: return 'GII';
      case 3: return 'GIII';
      default: return '';
    }
  }

  /** 距離区分番号を日本語名に変換する
   * @param d - 距離区分番号（1~4）
   * @returns 距離区分名
   */
  getDistance(d: number): string {
    switch (d) {
      case 1: return '短距離';
      case 2: return 'マイル';
      case 3: return '中距離';
      case 4: return '長距離';
      default: return '';
    }
  }

  /** レースの出走可能時期を日本語スラッシュ区切りで返す
   * @param race - 対象レース
   * @returns 「ジュニア/クラシック/シニア」形式の文字列
   */
  getRunSeason(race: Race): string {
    const parts: string[] = [];
    if (race.junior_flag) parts.push('ジュニア');
    if (race.classic_flag) parts.push('クラシック');
    if (race.senior_flag) parts.push('シニア');
    return parts.join('/');
  }
}
