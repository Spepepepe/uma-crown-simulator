import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AptitudeBadgeComponent } from '../../shared/components/aptitude-badge/aptitude-badge';
import { ToastService } from '../../shared/components/toast/toast.service';
import { environment } from '../../environments/environment';
import { Umamusume, Race } from '@shared/types';

@Component({
  selector: 'app-character-regist',
  standalone: true,
  imports: [FormsModule, AptitudeBadgeComponent],
  template: `
    <div class="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
         style="background-image: url('/image/backgroundFile/character-regist.png')"></div>
    <div class="min-h-screen p-6">
    <!-- ヘッダー: キャラ画像 + セレクト + 適性表示 -->
    <div class="flex items-center w-full mb-6 sticky top-0 bg-white/50 z-10 p-4 gap-6 flex-wrap justify-center">
      <!-- キャラ画像 -->
      <div class="p-2 bg-gradient-to-b from-green-400 to-green-100 rounded-xl shadow-lg">
        <div
          class="w-72 h-72 rounded-lg bg-gray-100 bg-cover bg-center bg-no-repeat"
          [style.background-image]="selectedUmamusume()
            ? 'url(/image/umamusumeData/' + selectedUmamusume()!.umamusume_name + '.png)'
            : 'none'"
        ></div>
      </div>

      <!-- セレクト + 適性 -->
      <div class="py-6 px-8 rounded-lg bg-white/70 shadow-lg">
        <div class="flex items-center mb-6">
          <label class="font-semibold mr-2 whitespace-nowrap">選択ウマ娘</label>
          <select
            class="flex-grow w-72 bg-green-200 border border-gray-300 rounded-lg p-3 text-pink-500 text-xl
                   transition-all duration-300 hover:scale-105 hover:shadow-md"
            [ngModel]="selectedUmamusumeId()"
            (ngModelChange)="onSelectUmamusume($event)"
          >
            <option [ngValue]="null">ウマ娘を選択</option>
            @for (u of umamusumes(); track u.umamusume_id) {
              <option [ngValue]="u.umamusume_id">{{ u.umamusume_name }}</option>
            }
          </select>
        </div>

        @if (selectedUmamusume()) {
          <div class="space-y-4">
            <div>
              <div class="font-semibold mb-2">バ場適性</div>
              <div class="flex gap-2">
                <app-aptitude-badge name="芝" [aptitude]="selectedUmamusume()!.turf_aptitude" />
                <app-aptitude-badge name="ダート" [aptitude]="selectedUmamusume()!.dirt_aptitude" />
              </div>
            </div>
            <div>
              <div class="font-semibold mb-2">距離適性</div>
              <div class="flex gap-2">
                <app-aptitude-badge name="短距離" [aptitude]="selectedUmamusume()!.sprint_aptitude" />
                <app-aptitude-badge name="マイル" [aptitude]="selectedUmamusume()!.mile_aptitude" />
                <app-aptitude-badge name="中距離" [aptitude]="selectedUmamusume()!.classic_aptitude" />
                <app-aptitude-badge name="長距離" [aptitude]="selectedUmamusume()!.long_distance_aptitude" />
              </div>
            </div>
            <div>
              <div class="font-semibold mb-2">脚質適性</div>
              <div class="flex gap-2">
                <app-aptitude-badge name="逃げ" [aptitude]="selectedUmamusume()!.front_runner_aptitude" />
                <app-aptitude-badge name="先行" [aptitude]="selectedUmamusume()!.early_foot_aptitude" />
                <app-aptitude-badge name="差し" [aptitude]="selectedUmamusume()!.midfield_aptitude" />
                <app-aptitude-badge name="追込" [aptitude]="selectedUmamusume()!.closer_aptitude" />
              </div>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- レーステーブル -->
    <div class="mt-6">
      <div class="overflow-y-auto max-h-[calc(100vh-22rem)]">
        <table class="table-auto w-full border-collapse border border-gray-300">
          <thead class="bg-gray-200 sticky top-0">
            <tr>
              <th class="border border-gray-500 px-2 py-2">出走済</th>
              <th class="border border-gray-500 px-4 py-2">レース名</th>
              <th class="border border-gray-500 px-4 py-2">クラス</th>
              <th class="border border-gray-500 px-4 py-2">馬場</th>
              <th class="border border-gray-500 px-4 py-2">距離</th>
              <th class="border border-gray-500 px-4 py-2">出走時期</th>
              <th class="border border-gray-500 px-4 py-2">月</th>
            </tr>
          </thead>
          <tbody>
            @for (race of races(); track race.race_id) {
              <tr class="hover:bg-gray-50">
                <td class="border border-gray-500 px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    class="h-6 w-6"
                    [checked]="race.checked"
                    (change)="onCheckboxChange(race.race_id, $event)"
                  />
                </td>
                <td class="border border-gray-500 px-4 py-2 text-center">{{ race.race_name }}</td>
                <td class="border border-gray-500 px-4 py-2 text-center">{{ getRaceRank(race.race_rank) }}</td>
                <td class="border border-gray-500 px-4 py-2 text-center">{{ race.race_state ? 'ダート' : '芝' }}</td>
                <td class="border border-gray-500 px-4 py-2 text-center">{{ getDistance(race.distance) }}/{{ race.distance_detail }}m</td>
                <td class="border border-gray-500 px-4 py-2 text-center">{{ getRunSeason(race) }}</td>
                <td class="border border-gray-500 px-4 py-2 text-center">{{ race.race_months }}月{{ race.half_flag ? '後半' : '前半' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- 登録ボタンエリア -->
      <div class="mt-6 flex justify-center items-center space-x-4">
        <button
          class="bg-green-500 text-white py-2 px-4 rounded-md shadow-md hover:bg-green-600 cursor-pointer"
          (click)="selectAll()"
        >
          全出走
        </button>

        <button
          class="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white py-3 px-8 rounded-full shadow-lg
                 hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          [disabled]="!selectedUmamusume()"
          (click)="registerCharacter()"
        >
          登録
        </button>
      </div>
    </div>
    </div>
  `,
})
export class CharacterRegistComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  umamusumes = signal<Umamusume[]>([]);
  races = signal<(Race & { checked: boolean })[]>([]);
  selectedUmamusume = signal<Umamusume | null>(null);
  selectedUmamusumeId = signal<number | null>(null);

  ngOnInit() {
    this.fetchUmamusumes();
    this.fetchRaces();
  }

  private fetchUmamusumes() {
    this.http
      .get<Umamusume[]>(`${environment.apiUrl}/umamusumes/unregistered`)
      .subscribe({
        next: (data) => this.umamusumes.set(data),
        error: (err) => console.error('Failed to fetch umamusumes:', err),
      });
  }

  private fetchRaces() {
    this.http
      .get<Race[]>(`${environment.apiUrl}/races/registration-targets`)
      .subscribe({
        next: (data) =>
          this.races.set(data.map((r) => ({ ...r, checked: false }))),
        error: (err) => console.error('Failed to fetch races:', err),
      });
  }

  onSelectUmamusume(id: number | null) {
    this.selectedUmamusumeId.set(id);
    if (id) {
      const uma = this.umamusumes().find((u) => u.umamusume_id === id) ?? null;
      this.selectedUmamusume.set(uma);
    } else {
      this.selectedUmamusume.set(null);
    }
  }

  onCheckboxChange(raceId: number, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.races.update((races) =>
      races.map((r) => (r.race_id === raceId ? { ...r, checked } : r)),
    );
  }

  selectAll() {
    this.races.update((races) => races.map((r) => ({ ...r, checked: true })));
  }

  registerCharacter() {
    const uma = this.selectedUmamusume();
    if (!uma) return;

    const raceIds = this.races()
      .filter((r) => r.checked)
      .map((r) => r.race_id);

    this.http
      .post(`${environment.apiUrl}/umamusumes/registrations`, {
        umamusumeId: uma.umamusume_id,
        raceIdArray: raceIds,
      })
      .subscribe({
        next: () => {
          this.toastService.show('登録が完了しました', 'success');
          this.router.navigate(['/character-list']);
        },
        error: (err) => {
          console.error('Registration failed:', err);
          this.toastService.show('登録に失敗しました', 'error');
        },
      });
  }

  getRaceRank(rank: number): string {
    switch (rank) {
      case 1: return 'GI';
      case 2: return 'GII';
      case 3: return 'GIII';
      default: return '';
    }
  }

  getDistance(d: number): string {
    switch (d) {
      case 1: return '短距離';
      case 2: return 'マイル';
      case 3: return '中距離';
      case 4: return '長距離';
      default: return '';
    }
  }

  getRunSeason(race: Race): string {
    const parts: string[] = [];
    if (race.junior_flag) parts.push('ジュニア');
    if (race.classic_flag) parts.push('クラシック');
    if (race.senior_flag) parts.push('シニア');
    return parts.join('/');
  }
}
