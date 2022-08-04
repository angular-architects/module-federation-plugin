import { Router, UrlMatcher, UrlSegment } from '@angular/router';

export function startsWith(prefix: string): UrlMatcher {
    return (url: UrlSegment[]) => {
        const fullUrl = url.map(u => u.path).join('/');
        if (fullUrl.startsWith(prefix)) {
            return ({ consumed: url});
        }
        return null;
    };
}

export function endsWith(prefix: string): UrlMatcher {
    return (url: UrlSegment[]) => {
        const fullUrl = url.map(u => u.path).join('/');
        if (fullUrl.endsWith(prefix)) {
            return ({ consumed: url });
        }
        return null;
    };
}

export function connectRouter(router: Router, useHash: boolean = false): void {
    if (!useHash) {
        router.navigateByUrl(`${location.pathname.substring(1)}${location.search}`);
        window.addEventListener('popstate', () => {
            router.navigateByUrl(`${location.pathname.substring(1)}${location.search}`);
        });
    }
    else {
        router.navigateByUrl(`${location.hash.substring(1)}${location.search}`);
        window.addEventListener('hashchange', () => {
            router.navigateByUrl(`${location.hash.substring(1)}${location.search}`);
        });
    }
}
