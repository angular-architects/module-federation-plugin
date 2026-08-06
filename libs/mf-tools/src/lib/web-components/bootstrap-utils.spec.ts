import {
  Component,
  NgModule,
  NgModuleRef,
  NgZone,
  VERSION,
} from '@angular/core';
import { BrowserModule, platformBrowser } from '@angular/platform-browser';
import { getGlobalStateSlice } from '../utils/global-state';
import { bootstrap, getMajor, shareNgZone } from './bootstrap-utils';

// standalone: false is required from Angular 19 on, where standalone defaults
// to true and a component cannot then be declared by an NgModule.
@Component({
  selector: 'angular-architects-shell',
  template: '<span>shell</span>',
  standalone: false,
})
class ShellComponent {}

@NgModule({
  declarations: [ShellComponent],
  imports: [BrowserModule],
  bootstrap: [ShellComponent],
})
class ShellModule {}

@Component({
  selector: 'angular-architects-remote',
  template: '<span>remote</span>',
  standalone: false,
})
class RemoteComponent {}

@NgModule({
  declarations: [RemoteComponent],
  imports: [BrowserModule],
  bootstrap: [RemoteComponent],
})
class RemoteModule {}

describe('getMajor', () => {
  it('extracts the major version', () => {
    expect(getMajor('15.1.2')).toBe('15');
  });

  it('keeps the prerelease suffix so it does not collide with the release', () => {
    expect(getMajor('16.0.0-next.3')).toBe('16-next.3');
  });
});

describe('bootstrap', () => {
  const refs: NgModuleRef<unknown>[] = [];

  beforeEach(() => {
    document.body.innerHTML =
      '<angular-architects-shell></angular-architects-shell><angular-architects-remote></angular-architects-remote>';
  });

  afterEach(() => {
    while (refs.length) {
      refs.pop()?.destroy();
    }
    document.body.innerHTML = '';
  });

  it('boots a module and reuses the cached platform for the next one', async () => {
    // The whole point of the package: a shell and a micro frontend on the same
    // Angular version share one platform instead of each creating their own.
    const platformFactory = jest.fn(() => platformBrowser());

    const shellRef = await bootstrap(ShellModule, {
      production: false,
      appType: 'shell',
      platformFactory,
      version: () => VERSION,
    });
    refs.push(shellRef);

    expect(document.body.textContent).toContain('shell');
    expect(platformFactory).toHaveBeenCalledTimes(1);

    const remoteRef = await bootstrap(RemoteModule, {
      production: false,
      platformFactory,
      version: () => VERSION,
    });
    refs.push(remoteRef);

    expect(document.body.textContent).toContain('remote');
    expect(platformFactory).toHaveBeenCalledTimes(1);
  });

  it('publishes the shell NgZone so micro frontends can adopt it', async () => {
    const shellRef = await bootstrap(ShellModule, {
      production: false,
      appType: 'shell',
      platformFactory: () => platformBrowser(),
      version: () => VERSION,
    });
    refs.push(shellRef);

    const shared = getGlobalStateSlice(
      (state: { ngZone: NgZone }) => state.ngZone,
    );

    expect(shared).toBe(shellRef.injector.get(NgZone));
    // The legacy window slot is still written for older remotes.
    expect(window['ngZone']).toBe(shared);
  });
});

describe('shareNgZone', () => {
  it('writes the zone to both the namespaced state and the legacy slot', () => {
    const zone = new NgZone({});

    shareNgZone(zone);

    expect(
      getGlobalStateSlice((state: { ngZone: NgZone }) => state.ngZone),
    ).toBe(zone);
    expect(window['ngZone']).toBe(zone);
  });
});
