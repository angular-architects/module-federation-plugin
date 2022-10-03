import { Location } from '@angular/common';
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


export function connectRouter(router: Router, newLocation?: Location) {
  if (!router) {
    // eslint-disable-next-line no-console
    console.warn('No router to connect found');
    return;
  }
  router.initialNavigation();
  if (location) {
    void router.navigateByUrl(newLocation.path(true))
  }
}
