import { Component, inject } from '@angular/core';
import {
  AuthService,
  PlaygroundLibModule,
} from '@angular-architects/playground-lib';

@Component({
  selector: 'angular-architects-flight-search',
  imports: [PlaygroundLibModule],
  template: `
    <h2>Flight Search</h2>

    <p>
      <code>AuthService.userName</code> as seen from rspack-mfe1:
      <strong>{{ userName || '(empty)' }}</strong>
    </p>

    <!-- playground-lib is shared as a singleton, so this renders the name the
         shell logged in with — across two separate rspack builds. -->
    <angular-architects-auth />

    <ul>
      @for (flight of flights; track flight.id) {
        <li>{{ flight.from }} &rarr; {{ flight.to }}</li>
      }
    </ul>
  `,
})
export class FlightSearchComponent {
  private authService = inject(AuthService);

  userName = this.authService.userName;

  flights = [
    { id: 1, from: 'Amsterdam', to: 'Vienna' },
    { id: 2, from: 'Vienna', to: 'Graz' },
    { id: 3, from: 'Graz', to: 'Amsterdam' },
  ];
}
