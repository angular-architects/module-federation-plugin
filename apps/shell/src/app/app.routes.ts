import { loadRemoteModule } from '@angular-architects/module-federation';
import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
  },

  // mfe1 exposes routes, so it owns everything under /flights.
  {
    path: 'flights',
    loadChildren: () =>
      loadRemoteModule({
        type: 'manifest',
        remoteName: 'mfe1',
        exposedModule: './routes',
      }).then((m) => m.FLIGHT_ROUTES),
  },

  // mfe2 exposes a single component, which the shell routes to itself.
  {
    path: 'dashboard',
    loadComponent: () =>
      loadRemoteModule({
        type: 'manifest',
        remoteName: 'mfe2',
        exposedModule: './Component',
      }).then((m) => m.DashboardComponent),
  },

  {
    path: '**',
    loadComponent: () =>
      import('./not-found.component').then((m) => m.NotFoundComponent),
  },
];
