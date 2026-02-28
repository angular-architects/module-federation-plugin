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

  // Invalidate all source files, Angular doesn't provide a way to give the invalidated files yet.
  const keys = new Set([..._codeBundleCache.keys()].filter(k => !k.includes('node_modules')));
  _codeBundleCache.invalidate(keys);
}
