import { TestBed } from '@angular/core/testing';
import { AuthService } from '@angular-architects/playground-lib';

import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  it('reads the user name from the shared AuthService', async () => {
    TestBed.inject(AuthService).userName = 'Jane';

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.userName).toBe('Jane');
    expect(fixture.nativeElement.textContent).toContain('Jane');
  });
});
