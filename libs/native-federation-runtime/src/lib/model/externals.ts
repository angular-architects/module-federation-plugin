import { SharedInfo } from './federation-info';
import { globalCache } from './global-cache';

const externals = globalCache.externals;

function getExternalKey(shared: SharedInfo) {
  // Singletons must dedupe across versions: a remote and host requesting the same
  // singleton package at different versions should resolve to a single instance
  // (the first one registered, typically the host's). Keeping the version suffix
  // for singletons creates two distinct externals — both load at runtime and
  // singleton invariants (e.g. Angular's injector tree) break.
  // Non-singletons keep the version suffix so distinct versions can intentionally
  // coexist.
  return shared.singleton
    ? shared.packageName
    : `${shared.packageName}@${shared.version}`;
}

export function getExternalUrl(shared: SharedInfo): string | undefined {
  const packageKey = getExternalKey(shared);
  return externals.get(packageKey);
}

export function setExternalUrl(shared: SharedInfo, url: string): void {
  const packageKey = getExternalKey(shared);
  externals.set(packageKey, url);
}
