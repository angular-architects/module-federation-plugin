import { Component } from '@angular/core';

@Component({
  selector: 'angular-architects-home',
  template: `
    <p>
      Type a name above, then open <em>Flights</em> or <em>Dashboard</em>. Both
      come from <code>rspack-mfe1</code> on <code>:4301</code> — a separate
      rspack build — and both read the name back out of the same
      <code>AuthService</code> instance.
    </p>
    <p>
      This is the same demo as <code>apps/shell</code>, built with rspack instead
      of webpack. Watch the network tab: <code>remoteEntry.js</code> is fetched
      as an ES module via <code>import()</code>, not injected as a script tag.
    </p>
  `,
})
export class HomeComponent {}
