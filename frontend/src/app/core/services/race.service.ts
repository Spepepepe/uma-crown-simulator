import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Race, RaceSlot, RemainingRace } from '@shared/types';
import { RacePatternResponse } from '@shared/types';

@Injectable({ providedIn: 'root' })
export class RaceService {
  private readonly http = inject(HttpClient);

  /** 馬場・距離フィルタ付きでレース一覧を取得する */
  getRaces(state?: number, distance?: number): Observable<Race[]> {
    let params = new HttpParams();
    if (state !== undefined) params = params.set('state', state.toString());
    if (distance !== undefined) params = params.set('distance', distance.toString());
    return this.http.get<Race[]>(`${environment.apiUrl}/races`, { params });
  }

  /** 登録用レース一覧（G1〜G3）を取得する */
  getRegistrationTargets(): Observable<Race[]> {
    return this.http.get<Race[]>(`${environment.apiUrl}/races/registration-targets`);
  }

  /** 残レース情報の一覧を取得する */
  getRemainingRaces(): Observable<RemainingRace[]> {
    return this.http.get<RemainingRace[]>(`${environment.apiUrl}/races/remaining`);
  }

  /** 指定ウマ娘のレースパターンを取得する */
  getPatterns(umamusumeId: number): Observable<RacePatternResponse> {
    return this.http.get<RacePatternResponse>(
      `${environment.apiUrl}/races/patterns/${umamusumeId}`,
    );
  }

  /** 現在のパターンの全レースを一括登録する */
  registerBatchResults(umamusumeId: number, races: RaceSlot[]): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/races/results/batch`, {
      umamusumeId,
      races,
    });
  }

  /** 指定したレースを1件登録する */
  registerOneResult(umamusumeId: number, race: RaceSlot): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/races/results`, {
      umamusumeId,
      race,
    });
  }
}
