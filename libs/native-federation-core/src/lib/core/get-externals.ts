import { NormalizedFederationConfig } from '../config/federation-config';
import { DEFAULT_SKIP_LIST } from './default-skip-list';

export function getExternals(config: NormalizedFederationConfig) {
  const shared = Object.keys(config.shared);
  const sharedMappings = config.sharedMappings.map((m) => m.key);

  const externals = [...shared, ...sharedMappings];

  return externals.filter((p) => !DEFAULT_SKIP_LIST.has(p));
}
