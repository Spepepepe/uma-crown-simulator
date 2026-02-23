import { Component, inject } from '@angular/core';
import { AuthService } from './core/services/auth.service';
import { NavigationService } from './core/services/navigation.service';
import { SidebarComponent } from './shared/components/sidebar/sidebar';
import { ToastComponent } from './shared/components/toast/toast';
import { LoginComponent } from './features/auth/login/login';
import { RegisterComponent } from './features/auth/register/register';
import { CharacterListComponent } from './features/character-list/character-list';
import { CharacterRegistComponent } from './features/character-regist/character-regist';
import { RaceListComponent } from './features/race-list/race-list';
import { RemainingRaceListComponent } from './features/remaining-race/remaining-race-list';
import { RemainingRacePatternComponent } from './features/remaining-race/remaining-race-pattern';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    SidebarComponent,
    ToastComponent,
    LoginComponent,
    RegisterComponent,
    CharacterListComponent,
    CharacterRegistComponent,
    RaceListComponent,
    RemainingRaceListComponent,
    RemainingRacePatternComponent,
  ],
  template: `
    <app-toast />

    @if (!authService.isLoggedIn()) {
      @if (navService.currentView().page === 'register') {
        <app-register />
      } @else {
        <app-login />
      }
    } @else {
      <div class="flex h-screen">
        <app-sidebar />
        <main class="flex-1 overflow-auto no-scrollbar">
          @switch (navService.currentView().page) {
            @case ('character-list') {
              <app-character-list />
            }
            @case ('character-regist') {
              <app-character-regist />
            }
            @case ('race-list') {
              <app-race-list />
            }
            @case ('remaining-race') {
              <app-remaining-race-list />
            }
            @case ('remaining-race-pattern') {
              <app-remaining-race-pattern [umamusumeId]="patternUmamusumeId" />
            }
            @default {
              <app-character-list />
            }
          }
        </main>
      </div>
    }
  `,
})
/** アプリケーションのルートコンポーネント。NavigationServiceの状態に応じて画面を切り替える */
export class App {
  protected readonly authService = inject(AuthService);
  protected readonly navService = inject(NavigationService);

  /** パターン画面に渡すウマ娘ID。現在のビューがパターン画面でない場合は0 */
  get patternUmamusumeId(): number {
    const v = this.navService.currentView();
    return v.page === 'remaining-race-pattern' ? v.umamusumeId : 0;
  }
}
