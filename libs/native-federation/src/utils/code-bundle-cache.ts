import { SourceFileCache } from '@angular/build/private';

let _codeBundleCache: SourceFileCache | undefined = undefined;

export function setCodeBundleCache(path: string) {
  if (!!_codeBundleCache) return;
  _codeBundleCache = new SourceFileCache(path);
}

export function getCodeBundleCache() {
  return _codeBundleCache;
}
