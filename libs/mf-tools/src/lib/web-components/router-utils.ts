import { Router, UrlMatcher, UrlSegment } from '@angular/router';
import { NgZone } from '@angular/core';

export function startsWith(prefix: string): UrlMatcher {
  return (url: UrlSegment[]) => {
    const fullUrl = url.map((u) => u.path).join('/');
    if (fullUrl.startsWith(prefix)) {
      return { consumed: url };
    }
    return null;
  };
}

export function endsWith(prefix: string): UrlMatcher {
  return (url: UrlSegment[]) => {
    const fullUrl = url.map((u) => u.path).join('/');
    if (fullUrl.endsWith(prefix)) {
      return { consumed: url };
    }
    return null;
  };
}

function navigateWithNgZone(router: Router, ngZone: NgZone, url: string) {
  ngZone.run(() => router.navigateByUrl(url));
}

export function connectRouter(router: Router, useHash = false, ngZone = undefined): void {
  let url: string;
  if (!useHash) {
    url = `${location.pathname.substring(1)}${location.search}`;
    !!ngZone ? navigateWithNgZone(router, ngZone, url) : router.navigateByUrl(url);
    window.addEventListener('popstate', () => {
      !!ngZone ? navigateWithNgZone(router, ngZone, url) : router.navigateByUrl(url);
    });
  } else {
    url = `${location.hash.substring(1)}${location.search}`;
    !!ngZone ? navigateWithNgZone(router, ngZone, url) : router.navigateByUrl(url);
    window.addEventListener('hashchange', () => {
      !!ngZone ? navigateWithNgZone(router, ngZone, url) : router.navigateByUrl(url);
    });
  }
}
