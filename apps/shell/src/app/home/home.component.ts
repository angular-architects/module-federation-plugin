import { Component } from '@angular/core';

@Component({
  selector: 'angular-architects-home',
  template: `
    <p>
      Type a name above, then open <em>Flights</em> or <em>Dashboard</em>. Both
      are separate builds served from other ports, and both read the name back
      out of the same <code>AuthService</code> instance.
    </p>
    <p>
      Watch the network tab: <code>remoteEntry.js</code> comes from
      <code>:4201</code>/<code>:4202</code>, but Angular itself is downloaded
      once, by whichever build gets there first.
    </p>
  `,
})
export class HomeComponent {}
