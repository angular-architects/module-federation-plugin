import { AuthService } from '@angular-architects/playground-lib';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  standalone: true,
  selector: 'angular-architects-demo',
  templateUrl: './demo.component.html',
  styleUrls: ['./demo.component.css'],
  imports: [CommonModule],
})
export class DemoComponent {
  title = 'Hallo';

  constructor(authService: AuthService) {
    console.log('userName', authService.userName);
  }
}
