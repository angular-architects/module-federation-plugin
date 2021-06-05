import { CompilerOptions, enableProdMode, NgModuleRef, NgZone, PlatformRef, Type } from "@angular/core";
import { platformBrowser } from "@angular/platform-browser";
import { VERSION } from '@angular/core';

export type Options = {
    production: boolean,
    platformFactory?: () => PlatformRef,
    compilerOptions?: CompilerOptions & BootstrapOptions,
    version?: () => string,
};

declare interface BootstrapOptions {
    ngZone?: NgZone | 'zone.js' | 'noop';
    ngZoneEventCoalescing?: boolean;
    ngZoneRunCoalescing?: boolean;
}

export type PlatformCache = {
    platform: { [key: string]: PlatformRef }
};

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

function getPlatformCache(): PlatformCache {
    const platformCache = window as unknown as PlatformCache;
    platformCache.platform = platformCache.platform || {};
    return platformCache;
}

function getNgZone(): NgZone {
    return window['ngZone'];
}   

export function shareNgZone(zone: NgZone): void {
    window['ngZone'] = zone;
}

export function bootstrap<M>(module: Type<M>, options: Options): Promise<NgModuleRef<M>> {

    if (!options.platformFactory) {
        options.platformFactory = () => platformBrowser();
    }

    if (!options.compilerOptions?.ngZone) {
        options.compilerOptions = options.compilerOptions || {};
        options.compilerOptions.ngZone = getNgZone();
    }

    if (!options.version) {
        options.version = () => VERSION.full;
    }

    const key = options.version(); 
    const platformCache = getPlatformCache();

    let platform = platformCache.platform[key];
    if (!platform) {
        platform = options.platformFactory();
        platformCache.platform[key] = platform; 

        if (options.production) {
            enableProdMode();
        }
    }

    return platform.bootstrapModule(module, options.compilerOptions);
}