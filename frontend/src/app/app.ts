import { Component, inject } from '@angular/core';
import { NavigationService } from './core/services/navigation.service';
import { SidebarComponent } from './shared/components/sidebar/sidebar';
import { ToastComponent } from './shared/components/toast/toast';
import { LandingComponent } from './features/landing/landing';
import { LoginComponent } from './features/auth/login/login';
import { RegisterComponent } from './features/auth/register/register';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password';
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
    LandingComponent,
    LoginComponent,
    RegisterComponent,
    ForgotPasswordComponent,
    CharacterListComponent,
    CharacterRegistComponent,
    RaceListComponent,
    RemainingRaceListComponent,
    RemainingRacePatternComponent,
  ],
  template: `
    <app-toast />

    <div class="flex h-screen">
      <app-sidebar />
      <main class="flex-1 overflow-auto no-scrollbar">
        @switch (navService.currentView().page) {
          @case ('landing') {
            <app-landing />
          }
          @case ('login') {
            <app-login />
          }
          @case ('register') {
            <app-register />
          }
          @case ('forgot-password') {
            <app-forgot-password />
          }
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
            <app-landing />
          }
        }
      </main>
    </div>
  `,
})
/** アプリケーションのルートコンポーネント。NavigationServiceの状態に応じて画面を切り替える */
export class App {
  protected readonly navService = inject(NavigationService);

  /** パターン画面に渡すウマ娘ID。現在のビューがパターン画面でない場合は0 */
  get patternUmamusumeId(): number {
    const v = this.navService.currentView();
    return v.page === 'remaining-race-pattern' ? v.umamusumeId : 0;
  }
}
