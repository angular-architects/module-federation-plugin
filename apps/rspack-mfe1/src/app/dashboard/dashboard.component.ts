import { Component, inject } from '@angular/core';
import {
  AuthService,
  PlaygroundLibModule,
} from '@angular-architects/playground-lib';

// Exposed as './Component' — see apps/rspack-mfe1/module-federation.config.ts.
@Component({
  selector: 'angular-architects-dashboard',
  imports: [PlaygroundLibModule],
  template: `
    <h2>Dashboard</h2>

    <p>
      <code>AuthService.userName</code> as seen from rspack-mfe1:
      <strong>{{ userName || '(empty)' }}</strong>
    </p>

    <angular-architects-auth />
  `,
})
export class DashboardComponent {
  private authService = inject(AuthService);

  userName = this.authService.userName;
}
