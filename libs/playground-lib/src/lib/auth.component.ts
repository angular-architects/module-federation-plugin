import { Component } from '@angular/core';
import { AuthService } from './auth.service';

@Component({
    selector: 'angular-architects-auth',
    template: `
        <p>AuthComponent</p>
        <p>User Name: {{userName}}</p>
    `,
    styles: [`
        p { color: blue; }
    `]
})
export class AuthComponent {
    
    userName = '';
    
    constructor(authService: AuthService) { 
        this.userName = authService.userName;
    }

}
