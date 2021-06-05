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

export function connectRouter(router: Router, useHash = false) {
    if (!useHash) {
        router.navigateByUrl(location.pathname.substr(1));
        window.addEventListener('popstate', () => {
            router.navigateByUrl(location.pathname.substr(1));
        });
    }
    else {
        router.navigateByUrl(location.hash.substr(1));
        window.addEventListener('hashchange', () => {
            router.navigateByUrl(location.hash.substr(1));
        });
    }
}