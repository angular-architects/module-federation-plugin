import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'angular-architects-root',
  imports: [RouterOutlet, RouterLink],
  template: `
    <h1>mfe1 — standalone</h1>
    <nav>
      <a routerLink="/">Home</a>
      <a routerLink="/flights">Flights</a>
    </nav>
    <router-outlet />
  `,
})
export class AppComponent {}
