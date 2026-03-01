import { Injectable, signal } from '@angular/core';

/** アプリ全体の表示ビューを表す判別共用体 */
export type ViewState =
  | { page: 'landing' }
  | { page: 'login' }
  | { page: 'register' }
  | { page: 'forgot-password' }
  | { page: 'character-list' }
  | { page: 'character-regist' }
  | { page: 'race-list' }
  | { page: 'remaining-race' }
  | { page: 'remaining-race-pattern'; umamusumeId: number };

/** URLルーターを使わずアプリ内の画面遷移を管理するサービス */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  /** 現在表示中のビュー状態 */
  readonly currentView = signal<ViewState>({ page: 'landing' });

  /**
   * 指定したビューに遷移する
   * @param view - 遷移先のビュー状態
   */
  navigate(view: ViewState): void {
    this.currentView.set(view);
  }
}
