import { Routes } from '@angular/router';

// The shell loads FLIGHT_ROUTES over Module Federation; running mfe1 on its own
// mounts exactly the same routes under /flights.
export const APP_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'flights',
    loadChildren: () =>
      import('./flights/flights.routes').then((m) => m.FLIGHT_ROUTES),
  },
];
