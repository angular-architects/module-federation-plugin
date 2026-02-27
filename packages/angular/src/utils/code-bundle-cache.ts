import { SourceFileCache } from '@angular/build/private';

let _codeBundleCache: SourceFileCache | undefined = undefined;

export function setCodeBundleCache(path: string) {
  if (_codeBundleCache) return;
  _codeBundleCache = new SourceFileCache(path);
}

export function getCodeBundleCache() {
  return _codeBundleCache;
}

export function invalidateCodeBundleCache() {
  if (!_codeBundleCache) return;
  for (const k of _codeBundleCache.keys()) {
    if (!k.includes('node_modules')) {
      _codeBundleCache.invalidate(k);
    }
  }
}
