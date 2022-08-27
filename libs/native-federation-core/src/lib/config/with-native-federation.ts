import { getMappedPaths, MappedPath } from '../utils/mapped-paths';
import { shareAll, share, findRootTsConfigJson } from '../config';
import {
  FederationConfig,
  NormalizedFederationConfig,
  NormalizedSharedConfig,
} from './federation-config';

export function withNativeFederation(
  config: FederationConfig
): NormalizedFederationConfig {
  const skip = new Set(config.skip) ?? new Set<string>();

  return {
    name: config.name ?? '',
    exposes: config.exposes ?? {},
    shared: normalizeShared(config, skip),
    sharedMappings: normalizeSharedMappings(config, skip),
  };
}

function normalizeShared(
  config: FederationConfig,
  skip: Set<string>
): Record<string, NormalizedSharedConfig> {
  let result: Record<string, NormalizedSharedConfig> = {};

  const shared = config.shared;

  if (!shared) {
    result = shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    }) as Record<string, NormalizedSharedConfig>;
  } else {
    result = Object.keys(shared).reduce(
      (acc, cur) => ({
        ...acc,
        [cur]: {
          requiredVersion: shared[cur].requiredVersion ?? 'auto',
          singleton: shared[cur].singleton ?? false,
          strictVersion: shared[cur].strictVersion ?? false,
          version: shared[cur].version,
        },
      }),
      {}
    );

    result = share(result) as Record<string, NormalizedSharedConfig>;
  }

  result = Object.keys(result)
    .filter((key) => !skip.has(key))
    .reduce(
      (acc, cur) => ({
        ...acc,
        [cur]: result[cur],
      }),
      {}
    );

  return result;
}

function normalizeSharedMappings(
  config: FederationConfig,
  skip: Set<string>
): Array<MappedPath> {
  const rootTsConfigPath = findRootTsConfigJson();

  const paths = getMappedPaths({
    rootTsConfigPath,
    sharedMappings: config.sharedMappings,
  });

  const result = paths.filter((p) => !skip.has(p.key));

  return result;
}
