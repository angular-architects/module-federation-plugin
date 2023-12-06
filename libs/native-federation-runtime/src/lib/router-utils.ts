import { Router, UrlMatcher, UrlSegment } from '@angular/router';

const flatten = (url: UrlSegment[]): string => url.map((u) => u.path).join('/');

export function startsWith(prefix: string): UrlMatcher {
  return (url: UrlSegment[]) => {
    if (flatten(url).startsWith(prefix)) {
      return { consumed: url };
    }
    return null;
  };
}

export function endsWith(prefix: string): UrlMatcher {
  return (url: UrlSegment[]) => {
    if (flatten(url).endsWith(prefix)) {
      return { consumed: url };
    }
    return null;
  };
}

export function connectRouter(router: Router, useHash = false): void {
  let url: string;
  if (!useHash) {
    url = `${location.pathname.substring(1)}${location.search}`;
    router.navigateByUrl(url);
    window.addEventListener('popstate', () => {
      router.navigateByUrl(url);
    });
  } else {
    url = `${location.hash.substring(1)}${location.search}`;
    router.navigateByUrl(url);
    window.addEventListener('hashchange', () => {
      router.navigateByUrl(url);
    });
  }
}
