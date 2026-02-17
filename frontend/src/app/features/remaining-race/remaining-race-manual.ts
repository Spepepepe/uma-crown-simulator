import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../shared/components/toast/toast.service';
import { environment } from '../../environments/environment';
import { Race, Umamusume } from '@shared/types';

@Component({
  selector: 'app-remaining-race-manual',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="space-y-4">
      <h2 class="text-2xl font-bold text-center">
        {{ umamusumeName() }} - 手動出走
      </h2>

      <!-- フィルタ -->
      <div class="flex gap-4 justify-center flex-wrap">
        <div>
          <label class="font-semibold mr-2">時期</label>
          <select [(ngModel)]="selectedSeason" (ngModelChange)="fetchRaces()" class="border rounded p-2">
            <option [ngValue]="1">ジュニア</option>
            <option [ngValue]="2">クラシック</option>
            <option [ngValue]="3">シニア</option>
          </select>
        </div>
        <div>
          <label class="font-semibold mr-2">月</label>
          <select [(ngModel)]="selectedMonth" (ngModelChange)="fetchRaces()" class="border rounded p-2">
            @for (m of months; track m) {
              <option [ngValue]="m">{{ m }}月</option>
            }
          </select>
        </div>
        <div>
          <label class="font-semibold mr-2">前後半</label>
          <select [(ngModel)]="selectedHalf" (ngModelChange)="fetchRaces()" class="border rounded p-2">
            <option [ngValue]="false">前半</option>
            <option [ngValue]="true">後半</option>
          </select>
        </div>
      </div>

      <!-- オートモード -->
      <div class="flex items-center justify-center gap-2">
        <input type="checkbox" [(ngModel)]="isAutoMode" class="h-5 w-5" />
        <label class="text-sm">オートモード（出走後に自動的に次の期間に進む）</label>
      </div>

      <!-- レーステーブル -->
      <div class="overflow-y-auto h-[600px]">
        <table class="table-auto w-full border-collapse border border-gray-300">
          <thead class="bg-gray-200 sticky top-0">
            <tr>
              <th class="border border-gray-500 px-4 py-2">レース名</th>
              <th class="border border-gray-500 px-4 py-2">馬場</th>
              <th class="border border-gray-500 px-4 py-2">距離</th>
              <th class="border border-gray-500 px-4 py-2">別判定</th>
              <th class="border border-gray-500 px-4 py-2">出走</th>
            </tr>
          </thead>
          <tbody>
            @for (race of races(); track race.race_id) {
              <tr class="hover:bg-gray-50">
                <td class="border border-gray-500 px-4 py-2 text-center">{{ race.race_name }}</td>
                <td class="border border-gray-500 px-4 py-2 text-center">
                  <span class="px-2 py-1 rounded text-white text-sm" [class]="race.race_state === 0 ? 'bg-lime-500' : 'bg-amber-800'">
                    {{ race.race_state === 0 ? '芝' : 'ダート' }}
                  </span>
                </td>
                <td class="border border-gray-500 px-4 py-2 text-center">
                  <span class="px-2 py-1 rounded text-white text-sm" [class]="getDistanceColor(race.distance)">
                    {{ getDistanceLabel(race.distance) }}
                  </span>
                </td>
                <td class="border border-gray-500 px-4 py-2 text-center">
                  {{ getAvailabilityMark(race) }}
                </td>
                <td class="border border-gray-500 px-4 py-2 text-center">
                  <button
                    class="bg-blue-500 text-white py-1 px-4 rounded hover:bg-blue-600 cursor-pointer"
                    (click)="runRace(race.race_id)"
                  >出走</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- ナビゲーション -->
      <div class="flex justify-between">
        @if (isRaceReturn()) {
          <button
            class="bg-green-500 text-white py-2 px-6 rounded hover:bg-green-600 cursor-pointer"
            (click)="raceReturn()"
          >前へ</button>
        } @else {
          <button
            class="bg-red-500 text-white py-2 px-6 rounded hover:bg-red-600 cursor-pointer"
            (click)="goBack()"
          >戻る</button>
        }

        @if (isRaceForward()) {
          <button
            class="bg-blue-500 text-white py-2 px-6 rounded hover:bg-blue-600 cursor-pointer"
            (click)="raceForward()"
          >次へ</button>
        } @else {
          <button
            class="bg-red-500 text-white py-2 px-6 rounded hover:bg-red-600 cursor-pointer"
            (click)="goBack()"
          >戻る</button>
        }
      </div>
    </div>
  `,
})
export class RemainingRaceManualComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  private umamusumeId = 0;

  races = signal<Race[]>([]);
  umamusumeName = signal('');
  isRaceReturn = signal(false);
  isRaceForward = signal(false);

  selectedSeason = 1;
  selectedMonth = 7;
  selectedHalf: boolean = true;
  isAutoMode = false;

  months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  ngOnInit() {
    this.umamusumeId = Number(this.route.snapshot.paramMap.get('id'));
    this.fetchRaces();
  }

  fetchRaces() {
    this.http
      .get<{
        data: Race[];
        Props: { season: number; month: number; half: boolean; isRaceReturn: boolean; isRaceForward: boolean };
        umamusumeName?: string;
      }>(`${environment.apiUrl}/races/remaining/search`, {
        params: {
          umamusumeId: this.umamusumeId.toString(),
          season: this.selectedSeason.toString(),
          month: this.selectedMonth.toString(),
          half: this.selectedHalf.toString(),
        },
      })
      .subscribe({
        next: (res) => {
          this.races.set(res.data);
          this.isRaceReturn.set(res.Props.isRaceReturn);
          this.isRaceForward.set(res.Props.isRaceForward);
          if (res.umamusumeName) {
            this.umamusumeName.set(res.umamusumeName);
          }
        },
        error: (err) => console.error('Failed to fetch races:', err),
      });
  }

  runRace(raceId: number) {
    this.http
      .post(`${environment.apiUrl}/races/run`, {
        umamusumeId: this.umamusumeId,
        raceId,
      })
      .subscribe({
        next: () => {
          this.toastService.show('出走を登録しました', 'success');
          if (this.isAutoMode) {
            this.raceForward();
          } else {
            this.fetchRaces();
          }
        },
        error: (err) => {
          console.error('Failed to run race:', err);
          this.toastService.show('出走登録に失敗しました', 'error');
        },
      });
  }

  raceReturn() {
    if (this.selectedHalf) {
      this.selectedHalf = false;
    } else {
      this.selectedHalf = true;
      if (this.selectedMonth === 1) {
        if (this.selectedSeason > 1) {
          this.selectedSeason--;
          this.selectedMonth = 12;
        }
      } else {
        this.selectedMonth--;
      }
    }
    this.fetchRaces();
  }

  raceForward() {
    if (!this.selectedHalf) {
      this.selectedHalf = true;
    } else {
      this.selectedHalf = false;
      if (this.selectedMonth === 12) {
        if (this.selectedSeason < 3) {
          this.selectedSeason++;
          this.selectedMonth = 1;
        }
      } else {
        this.selectedMonth++;
      }
    }
    this.fetchRaces();
  }

  goBack() {
    this.router.navigate(['/remaining-race']);
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

  getAvailabilityMark(race: Race): string {
    const count = (race.junior_flag ? 1 : 0) + (race.classic_flag ? 1 : 0) + (race.senior_flag ? 1 : 0);
    return count > 1 ? '\u25CB' : '\u2715';
  }
}
