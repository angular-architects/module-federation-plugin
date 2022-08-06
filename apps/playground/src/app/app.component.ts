import { loadRemoteModule } from '@angular-architects/native-federation-runtime';
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
    // const m = await importShim('http://localhost:3001/cmp.js');
    
    const m = await loadRemoteModule({
      remoteEntry: 'http://localhost:3001/remoteEntry.json',
      // remoteName: 'mfe1',
      exposedModule: './cmp'
    });
    
    this.Cmp = m.DemoComponent;
  }

}
