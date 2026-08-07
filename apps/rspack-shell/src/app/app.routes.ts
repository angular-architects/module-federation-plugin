import { loadRemoteModule } from '@angular-architects/module-federation-runtime/enhanced';
import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
  },

  // The enhanced runtime resolves remotes by name against the manifest that
  // initFederation() registered, so there is no URL or `type` here — unlike the
  // classic runtime, which takes `{ type: 'manifest', remoteName, exposedModule }`.
  {
    path: 'flights',
    loadChildren: () =>
      loadRemoteModule({
        remoteName: 'rspackMfe1',
        exposedModule: './routes',
      }).then((m) => m.FLIGHT_ROUTES),
  },

  {
    path: 'dashboard',
    loadComponent: () =>
      loadRemoteModule({
        remoteName: 'rspackMfe1',
        exposedModule: './Component',
      }).then((m) => m.DashboardComponent),
  },

  {
    path: '**',
    loadComponent: () =>
      import('./not-found.component').then((m) => m.NotFoundComponent),
  },
];
