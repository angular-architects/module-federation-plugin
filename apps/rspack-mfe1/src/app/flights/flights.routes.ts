import { Routes } from '@angular/router';

// Exposed as './routes' — see apps/rspack-mfe1/module-federation.config.ts.
export const FLIGHT_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'search',
  },
  {
    path: 'search',
    loadComponent: () =>
      import('./flight-search.component').then((m) => m.FlightSearchComponent),
  },
];
