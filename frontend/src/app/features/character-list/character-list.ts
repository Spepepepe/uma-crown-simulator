import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { RegistUmamusume } from '@shared/types';

@Component({
  selector: 'app-character-list',
  standalone: true,
  imports: [],
  template: `
    <div class="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
         style="background-image: url('/image/backgroundFile/character-list.png')"></div>
    <div class="min-h-screen p-6">
    @if (loading()) {
      <div class="min-h-full flex justify-center items-center">
        <p class="text-gray-500 text-xl">読み込み中...</p>
      </div>
    } @else {
      <table class="table-auto w-full border-collapse border border-gray-300">
        <thead class="bg-gray-200 sticky top-0">
          <tr>
            <th class="border border-gray-500 px-2 py-2">画像</th>
            <th class="border border-gray-500 px-4 py-2">名前</th>
            <th class="border border-gray-500 px-2 py-2">芝</th>
            <th class="border border-gray-500 px-2 py-2">ダート</th>
            <th class="border border-gray-500 px-2 py-2">短距離</th>
            <th class="border border-gray-500 px-2 py-2">マイル</th>
            <th class="border border-gray-500 px-2 py-2">中距離</th>
            <th class="border border-gray-500 px-2 py-2">長距離</th>
            <th class="border border-gray-500 px-2 py-2">逃げ</th>
            <th class="border border-gray-500 px-2 py-2">先行</th>
            <th class="border border-gray-500 px-2 py-2">差し</th>
            <th class="border border-gray-500 px-2 py-2">追込</th>
          </tr>
        </thead>
        <tbody>
          @for (reg of registUmamusumes(); track reg.umamusume.umamusume_id) {
            <tr class="hover:bg-gray-50">
              <td class="p-2 align-middle">
                <div class="p-1 bg-gradient-to-b from-green-400 to-green-100 rounded-lg shadow-md w-20 h-20 mx-auto">
                  <div
                    class="w-full h-full rounded-md bg-gray-100 bg-cover bg-center"
                    [style.background-image]="'url(/image/umamusumeData/' + reg.umamusume.umamusume_name + '.png)'"
                  ></div>
                </div>
              </td>
              <td class="border border-gray-500 px-4 py-2 text-center">{{ reg.umamusume.umamusume_name }}</td>
              <td class="border border-gray-500 px-2 py-2 text-center">{{ reg.umamusume.turf_aptitude }}</td>
              <td class="border border-gray-500 px-2 py-2 text-center">{{ reg.umamusume.dirt_aptitude }}</td>
              <td class="border border-gray-500 px-2 py-2 text-center">{{ reg.umamusume.sprint_aptitude }}</td>
              <td class="border border-gray-500 px-2 py-2 text-center">{{ reg.umamusume.mile_aptitude }}</td>
              <td class="border border-gray-500 px-2 py-2 text-center">{{ reg.umamusume.classic_aptitude }}</td>
              <td class="border border-gray-500 px-2 py-2 text-center">{{ reg.umamusume.long_distance_aptitude }}</td>
              <td class="border border-gray-500 px-2 py-2 text-center">{{ reg.umamusume.front_runner_aptitude }}</td>
              <td class="border border-gray-500 px-2 py-2 text-center">{{ reg.umamusume.early_foot_aptitude }}</td>
              <td class="border border-gray-500 px-2 py-2 text-center">{{ reg.umamusume.midfield_aptitude }}</td>
              <td class="border border-gray-500 px-2 py-2 text-center">{{ reg.umamusume.closer_aptitude }}</td>
            </tr>
          }
        </tbody>
      </table>
    }
    </div>
  `,
})
export class CharacterListComponent implements OnInit {
  private readonly http = inject(HttpClient);

  registUmamusumes = signal<RegistUmamusume[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.fetchUmamusumes();
  }

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
