import { RouterModule } from '@angular/router';
import { loadRemoteModule } from '@angular-architects/native-federation';
import { AuthService } from '@angular-architects/playground-lib';
import { Component, Type } from '@angular/core';
import { NgComponentOutlet, NgIf } from '@angular/common';

@Component({
  standalone: true,
  imports: [RouterModule, NgComponentOutlet, NgIf],
  selector: 'playground-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'playground';
  Cmp: Type<unknown> | undefined = undefined;

  constructor(authService: AuthService) {
    authService.userName = 'Jane Doe';
  }

  async load() {
    // const m = await importShim('http://localhost:3001/cmp.js');

    const m = await loadRemoteModule({
      remoteEntry: 'http://localhost:3001/remoteEntry.json',
      // remoteName: 'mfe1',
      exposedModule: './cmp',
    });

    this.Cmp = m.DemoComponent;
  }
}
