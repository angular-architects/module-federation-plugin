import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  {
    path: 'flights',
    loadChildren: () =>
      import('./flights/flights.routes').then((m) => m.FLIGHT_ROUTES),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
  },
  {
    path: '**',
    redirectTo: 'flights',
  },
];
