import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@angular-architects/playground-lib';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideRouter([])] }),
  );

  it('writes the login input straight into the shared AuthService', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('input');
    input.value = 'Jane';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    // Remotes resolve the same singleton out of the share scope at runtime,
    // which is what makes the name visible inside mfe1 and mfe2.
    expect(TestBed.inject(AuthService).userName).toBe('Jane');
  });
});
