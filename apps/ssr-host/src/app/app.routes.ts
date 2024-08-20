import { Route } from '@angular/router';
import { loadRemoteModule } from '@angular-architects/native-federation';
import { isPlatformServer } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';

export const appRoutes: Route[] = [
  {
    path: '',
    // canMatch: [() => !isPlatformServer(inject(PLATFORM_ID))],
    loadComponent: () =>
      loadRemoteModule('mfe-for-ssr', './AppComponent').then(
        (r) => r.AppComponent
      ),
  },
  //   {
  //   path: '',
  //   canMatch: [() => isPlatformServer(inject(PLATFORM_ID))],
  //   loadComponent: () => {
  //     // loadRemoteModule('project-app-ui', './Test').then((r) => r.TestComponent),
  //
  //     // @ts-ignore
  //     return import('./nx-welcome.component').then(
  //       (r) => r.NxWelcomeComponent
  //     );
  //   },
  // },
];
