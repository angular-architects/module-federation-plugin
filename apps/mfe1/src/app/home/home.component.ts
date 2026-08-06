import { Component } from '@angular/core';

@Component({
  selector: 'angular-architects-mfe1-home',
  template: `
    <p>
      This page only shows up when mfe1 runs on its own. The shell never loads
      it — it only pulls in the exposed <code>./routes</code>.
    </p>
  `,
})
export class HomeComponent {}
