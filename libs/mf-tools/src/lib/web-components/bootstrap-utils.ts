import {
  CompilerOptions,
  enableProdMode,
  Injector,
  NgModuleRef,
  NgZone,
  PlatformRef,
  Type,
  Version,
} from '@angular/core';
import { platformBrowser } from '@angular/platform-browser';
import { VERSION } from '@angular/core';
import {
  getGlobalStateSlice,
  setGlobalStateSlice,
} from '../utils/global-state';
import { Router } from '@angular/router';
import { connectRouter } from './router-utils';

export type AppType = 'shell' | 'microfrontend';

export type Options = {
  production: boolean;
  platformFactory?: () => PlatformRef;
  compilerOptions?: CompilerOptions & BootstrapOptions;
  version?: () => string | Version;
  appType?: AppType;
  /**
   * Opt-out of ngZone sharing.
   * Not recommanded.
   * Default value true.
   */
  ngZoneSharing?: boolean;
  /**
   * Opt-out of platformSharing sharing.
   * Possible, if dependencies are not shared or each bootstrapped
   * remote app uses a different version.
   * Default value true.
   */
  platformSharing?: boolean;
  /**
   * Deactivate support for legacy mode.
   * Only recommanded if all used implementations depend on
   * @angular-architects/module-federation-tools > 13.0.1.
   * Default value true.
   */
  activeLegacyMode?: boolean;
};

declare interface BootstrapOptions {
  ngZone?: NgZone | 'zone.js' | 'noop';
  ngZoneEventCoalescing?: boolean;
  ngZoneRunCoalescing?: boolean;
}

let ngZoneSharing = true;
let platformSharing = true;
let legacyMode = true;

export function getMajor(version: string): string {
  const pre = version.match(/\d+/)[0];
  const post = version.match(/-.*/);

  if (!pre) {
    throw new Error('Cound not identify major version: ' + version);
  }

  if (post) {
    return pre + post[0];
  }

  return pre;
}

/**
 * LEGACY IMPLEMENTATIONS START
 *
 * Can be deprecated in later major releases.
 *
 * To increase backwards compatibility legacy and current namespaces
 * within the window object are used.
 */

export type LegacyPlatformCache = {
  platform: Record<string, PlatformRef>;
};

function getLegacyPlatformCache(): LegacyPlatformCache {
  const platformCache = window as unknown as LegacyPlatformCache;
  platformCache.platform = platformCache.platform || {};
  return platformCache;
}

function getLegacyPlatform(key: string): PlatformRef {
  const platform = getLegacyPlatformCache().platform[key];
  /**
   * If dependencies are not shared, platform with same version is different
   * and shared platform will not be returned.
   */
  return platform instanceof PlatformRef ? platform : null;
}

function setLegacyPlatform(key: string, platform: PlatformRef): void {
  getLegacyPlatformCache().platform[key] = platform;
}

function getLegacyNgZone(): NgZone {
  return window['ngZone'];
}

function setLegacyNgZone(zone: NgZone): void {
  window['ngZone'] = zone;
}

/**
 * LEGACY IMPLEMENTATIONS END
 */

function getPlatformCache(): Map<Version, PlatformRef> {
  return (
    getGlobalStateSlice(
      (state: { platformCache: Map<Version, PlatformRef> }) =>
        state.platformCache
    ) ||
    setGlobalStateSlice({
      platformCache: new Map<Version, PlatformRef>(),
    }).platformCache
  );
}

function setPlatform(version: Version, platform: PlatformRef): void {
  if (platformSharing) {
    if (legacyMode) setLegacyPlatform(version.full, platform);
    getPlatformCache().set(version, platform);
  }
}

function getPlatform(options: Options): PlatformRef {
  if (!platformSharing) {
    return options.platformFactory();
  }

  const versionResult = options.version();
  const version = versionResult === VERSION.full ? VERSION : versionResult;
  const versionKey = typeof version === 'string' ? version : version.full;

  let platform =
    getPlatformCache().get(version as Version) ||
    (legacyMode && getLegacyPlatform(versionKey));

  if (!platform) {
    platform = options.platformFactory();
    setPlatform(VERSION, platform);
    if (options.production) enableProdMode();
  }

  return platform;
}

function getNgZone(): NgZone {
  return (
    getGlobalStateSlice((state: { ngZone: NgZone }) => state.ngZone) ||
    getLegacyNgZone()
  );
}

export function shareNgZone(zone: NgZone): void {
  if (ngZoneSharing) {
    if (legacyMode) setLegacyNgZone(zone);
    setGlobalStateSlice({ ngZone: zone });
  }
}

export function bootstrap<M>(
  module: Type<M>,
  options: Options
): Promise<NgModuleRef<M>> {
  ngZoneSharing = options.ngZoneSharing !== false;
  platformSharing = options.platformSharing !== false;
  legacyMode = options.activeLegacyMode !== false;
  options.platformFactory =
    options.platformFactory || (() => platformBrowser());
  options.version = options.version || (() => VERSION);

  if (ngZoneSharing && !options.compilerOptions?.ngZone) {
    options.compilerOptions = options.compilerOptions || {};
    options.compilerOptions.ngZone = getNgZone();
  }

  return getPlatform(options)
    .bootstrapModule(module, options.compilerOptions)
    .then((ref) => {
      if (options.appType === 'shell') {
        shareShellZone(ref.injector);
      } else if (options.appType === 'microfrontend') {
        connectMicroFrontendRouter(ref.injector);
      }

      return ref;
    });
}

function shareShellZone(injector: Injector) {
  const ngZone = injector.get(NgZone, null);
  if (!ngZone) {
    console.warn('No NgZone to share found');
    return;
  }
  shareNgZone(ngZone);
}

function connectMicroFrontendRouter(injector: Injector) {
  const router = injector.get(Router);
  const useHash = location.href.includes('#');

  if (!router) {
    console.warn('No router to connect found');
    return;
  }

  connectRouter(router, useHash);
}
