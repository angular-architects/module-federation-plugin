import { NormalizedFederationConfig } from '../config/federation-config';

export function getExternals(config: NormalizedFederationConfig) {
  const shared = Object.keys(config.shared);
  const sharedMappings = config.sharedMappings.map((m) => m.key);

  // TODO: Also handle deps that match RegExps and functions
  const depsToSkip = config.skip.strings;
  const externals = [...shared, ...sharedMappings, ...depsToSkip];

  return externals;
}
