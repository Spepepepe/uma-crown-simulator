import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { RegistUmamusume, Umamusume } from '@shared/types';

@Injectable({ providedIn: 'root' })
export class CharacterService {
  private readonly http = inject(HttpClient);

  /** 未登録ウマ娘の一覧を取得する */
  getUnregisteredUmamusumes(): Observable<Umamusume[]> {
    return this.http.get<Umamusume[]>(`${environment.apiUrl}/umamusumes/unregistered`);
  }

  /** 登録済みウマ娘の一覧を取得する */
  getRegisteredUmamusumes(): Observable<RegistUmamusume[]> {
    return this.http.get<RegistUmamusume[]>(`${environment.apiUrl}/umamusumes/registered`);
  }

  /** 選択したウマ娘と出走レースを登録する */
  registerCharacter(umamusumeId: number, raceIdArray: number[]): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/umamusumes/registrations`, {
      umamusumeId,
      raceIdArray,
    });
  }
}
