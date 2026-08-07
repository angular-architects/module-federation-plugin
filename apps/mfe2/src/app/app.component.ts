import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'angular-architects-root',
  imports: [RouterOutlet],
  template: `
    <h1>mfe2 — standalone</h1>
    <router-outlet />
  `,
})
export class AppComponent {}
