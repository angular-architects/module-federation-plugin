import { Component, OnInit, Type } from '@angular/core';

@Component({
  selector: 'angular-architects-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
 
  title = 'playground';
  Cmp: Type<unknown>;

  async load() {
    const m = await importShim('http://localhost:3001/cmp.js');
    this.Cmp = m['DemoComponent'];
  }

}
