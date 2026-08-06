import {
  AuthService,
  PlaygroundLibModule,
} from '@angular-architects/playground-lib';
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';

@Component({
  standalone: true,
  selector: 'angular-architects-demo',
  templateUrl: './demo.component.html',
  styleUrls: ['./demo.component.css'],
  imports: [CommonModule, PlaygroundLibModule],
})
export class DemoComponent {
  title = 'Hallo';

  constructor() {
    console.log('userName', inject(AuthService).userName);
  }
}
