import { TestBed } from '@angular/core/testing';
import { AuthService } from '@angular-architects/playground-lib';

import { FlightSearchComponent } from './flight-search.component';

describe('FlightSearchComponent', () => {
  it('reads the user name from the shared AuthService', async () => {
    // Mirrors what the shell does before the remote is loaded: the singleton
    // already carries a user name by the time the exposed route renders.
    TestBed.inject(AuthService).userName = 'Jane';

    const fixture = TestBed.createComponent(FlightSearchComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.userName).toBe('Jane');
    expect(fixture.nativeElement.textContent).toContain('Jane');
  });
});
