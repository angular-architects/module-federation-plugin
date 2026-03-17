import * as path from 'path';
import * as fs from 'fs';
import * as JSON5 from 'json5';
import { logger } from '../utils/logger';
import { resolveTsConfigWildcard } from './resolve-wildcard-keys';

export interface MappedPath {
  key: string;
  path: string;
}

export interface GetMappedPathsOptions {
  rootTsConfigPath: string;
  sharedMappings?: string[];
  rootPath?: string;
}

export function getMappedPaths({
  rootTsConfigPath,
  sharedMappings,
  rootPath,
}: GetMappedPathsOptions): Array<MappedPath> {
  const result: Array<MappedPath> = [];

  if (!path.isAbsolute(rootTsConfigPath)) {
    throw new Error(
      'SharedMappings.register: tsConfigPath needs to be an absolute path!',
    );
  }

  if (!rootPath) {
    rootPath = path.normalize(path.dirname(rootTsConfigPath));
  }
  const shareAllMappings = !sharedMappings;

  if (!sharedMappings) {
    sharedMappings = [];
  }
  const globSharedMappings = sharedMappings
    .filter((m) => m.endsWith('*'))
    .map((m) => m.slice(0, -1));

  const tsConfig = JSON5.parse(
    fs.readFileSync(rootTsConfigPath, { encoding: 'utf-8' }),
  );

  const mappings = tsConfig?.compilerOptions?.paths;

  if (!mappings) {
    return result;
  }

  for (const key in mappings) {
    if (mappings[key].length > 1) {
      logger.warn(
        '[shared-mapping][' +
          key +
          '] A mapping path with more than 1 entryPoint is currently not supported, falling back to the first path.',
      );
    }
    const libPaths = key.includes('*')
      ? resolveTsConfigWildcard(key, mappings[key][0], rootPath).map(
          ({ key, value }) => ({
            key,
            path: path.normalize(path.join(rootPath, value)),
          }),
        )
      : [{ key, path: path.normalize(path.join(rootPath, mappings[key][0])) }];

    libPaths
      .filter(
        (mapping) =>
          shareAllMappings ||
          sharedMappings.includes(mapping.key) ||
          globSharedMappings.some((m) => mapping.key.startsWith(m)),
      )
      .forEach((mapping) => {
        result.push(mapping);
      });
  }

  return result;
}
