import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@angular-architects/playground-lib';

@Component({
  selector: 'angular-architects-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  template: `
    <h1>shell — dynamic host</h1>

    <label>
      Log in as:
      <input [(ngModel)]="authService.userName" placeholder="your name" />
    </label>

    <nav>
      <a
        routerLink="/"
        routerLinkActive="active"
        [routerLinkActiveOptions]="{ exact: true }"
        >Home</a
      >
      <a routerLink="/flights" routerLinkActive="active">Flights (mfe1)</a>
      <a routerLink="/dashboard" routerLinkActive="active">Dashboard (mfe2)</a>
    </nav>

    <hr />

    <router-outlet />
  `,
  styles: `
    label {
      display: block;
      margin: 1rem 0;
    }
    nav {
      margin-bottom: 1rem;
    }
    .active {
      font-weight: bold;
    }
  `,
})
export class AppComponent {
  // Public so the template can bind straight to the shared singleton.
  authService = inject(AuthService);
}
