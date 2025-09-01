import { Router, UrlMatcher, UrlSegment } from '@angular/router';

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
