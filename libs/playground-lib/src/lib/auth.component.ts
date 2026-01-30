import { Component, inject } from '@angular/core';
import { AuthService } from './auth.service';

@Component({
  selector: 'angular-architects-auth',
  template: `
    <p>AuthComponent</p>
    <p>User Name: {{ userName }}</p>
  `,
  styles: [
    `
      p {
        color: blue;
      }
    `,
  ],
  standalone: false,
})
export class AuthComponent {
  userName = '';
  private authService = inject(AuthService);

  constructor() {
    this.userName = this.authService.userName;
  }
}
