import * as path from 'path';
import * as fs from 'fs';
import * as JSON5 from 'json5';
import * as glob from 'fast-glob';
import * as mm from 'micromatch';

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
      'SharedMappings.register: tsConfigPath needs to be an absolute path!'
    );
  }

  if (!rootPath) {
    rootPath = path.normalize(path.dirname(rootTsConfigPath));
  }
  const shareAll = !sharedMappings;

  if (!sharedMappings) {
    sharedMappings = [];
  }

  const tsConfig = JSON5.parse(
    fs.readFileSync(rootTsConfigPath, { encoding: 'utf-8' })
  );

  const mappings = resolveWildcardsToPaths(tsConfig?.compilerOptions?.paths);
  if (!mappings) {
    return result;
  }

  for (const key in mappings) {
    const libPath = path.normalize(path.join(rootPath, mappings[key][0]));

    if (sharedMappings.includes(key) || shareAll) {
      result.push({
        key,
        path: libPath,
      });
    }
  }

  return result;
}

function resolveWildcardsToPaths(paths: { [key: string]: string[] }): {
  [key: string]: string[];
} {
  let results = {};
  for (const key in paths) {
    const path = paths[key][0];
    if (path.includes('*')) {
      const entries = glob.sync(path, { unique: true });

      for (const entry of entries) {
        if (!entry.includes('index.ts') && !entry.includes('index.js')) {
          continue;
        }

        const capturedPath = mm.capture(path, entry);
        if (!capturedPath) {
          continue;
        }

        results = {
          ...results,
          [key.replace('*', capturedPath[0])]: [entry],
        };
      }
    } else {
      results = { ...results, [key]: [path] };
    }
  }
  return results;
}
