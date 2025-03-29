import { Component } from '@angular/core';
import { NxWelcomeComponent } from './nx-welcome.component';

@Component({
  selector: 'angular-architects-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [NxWelcomeComponent],
})
export class AppComponent {
  title = 'mfe2';
}
