import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register').then((m) => m.RegisterComponent),
  },
  {
    path: 'race-list',
    loadComponent: () =>
      import('./features/race-list/race-list').then((m) => m.RaceListComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: 'character-regist',
        loadComponent: () =>
          import('./features/character-regist/character-regist').then(
            (m) => m.CharacterRegistComponent,
          ),
      },
      {
        path: 'character-list',
        loadComponent: () =>
          import('./features/character-list/character-list').then(
            (m) => m.CharacterListComponent,
          ),
      },
      {
        path: 'remaining-race',
        loadComponent: () =>
          import('./features/remaining-race/remaining-race-list').then(
            (m) => m.RemainingRaceListComponent,
          ),
      },
      {
        path: 'remaining-race/:id/manual',
        loadComponent: () =>
          import('./features/remaining-race/remaining-race-manual').then(
            (m) => m.RemainingRaceManualComponent,
          ),
      },
      {
        path: 'remaining-race/:id/pattern',
        loadComponent: () =>
          import('./features/remaining-race/remaining-race-pattern').then(
            (m) => m.RemainingRacePatternComponent,
          ),
      },
      { path: '', redirectTo: 'character-list', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
