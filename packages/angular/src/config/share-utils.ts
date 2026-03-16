import type {
  ShareAllExternalsOptions,
  ShareExternalsOptions,
  SkipList,
  FederationConfig,
} from '@softarc/native-federation/domain';
import {
  share as coreShare,
  shareAll as coreShareAll,
  withNativeFederation as coreWithNativeFederation,
} from '@softarc/native-federation/config';
import { NG_SKIP_LIST } from './angular-skip-list.js';
import type { NormalizedSharedExternalsConfig } from '@softarc/native-federation/internal';

export function shareAll(
  config: ShareAllExternalsOptions,
  opts: {
    skipList?: SkipList;
    projectPath?: string;
    overrides?: ShareExternalsOptions;
  } = {}
): ShareExternalsOptions | null {
  if (!opts.skipList) opts.skipList = NG_SKIP_LIST;
  return coreShareAll(config, opts);
}

export function share(
  configuredShareObjects: ShareExternalsOptions,
  projectPath = '',
  skipList = NG_SKIP_LIST
): ShareExternalsOptions {
  return coreShare(configuredShareObjects, projectPath, skipList);
}

export function withNativeFederation(cfg: FederationConfig) {
  if (!cfg.platform) cfg.platform = getDefaultPlatform(Object.keys(cfg.shared ?? {}));

  const normalized = coreWithNativeFederation(cfg);

  // This is for being backwards compatible
  if (!normalized.features.ignoreUnusedDeps) {
    normalized.shared = removeNgLocales(normalized.shared);
  }

  return normalized;
}

function getDefaultPlatform(deps: string[]): 'browser' | 'node' {
  const server = deps.find(e =>
    ['@angular/platform-server', '@angular/ssr'].find(f => e.startsWith(f))
  );
  return server ? 'node' : 'browser';
}

function removeNgLocales(shared: NormalizedSharedExternalsConfig): NormalizedSharedExternalsConfig {
  const keys = Object.keys(shared).filter(k => !k.startsWith('@angular/common/locales'));

  const filtered = keys.reduce(
    (acc, curr) => ({
      ...acc,
      [curr]: shared[curr],
    }),
    {}
  );

  return filtered;
}
