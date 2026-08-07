import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

// Only used when rspack-mfe1 runs standalone on :4301. When the shell loads
// this remote it renders the exposed routes/component instead.
@Component({
  selector: 'angular-architects-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <h1>rspack-mfe1 — standalone</h1>

    <nav>
      <a routerLink="/flights" routerLinkActive="active">Flights</a>
      <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
    </nav>

    <hr />

    <router-outlet />
  `,
  styles: `
    nav {
      margin-bottom: 1rem;
    }
    .active {
      font-weight: bold;
    }
  `,
})
export class AppComponent {}
