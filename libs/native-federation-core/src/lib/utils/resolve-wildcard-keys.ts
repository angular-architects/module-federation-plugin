import fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export type KeyValuePair = {
  key: string;
  value: string;
};

// TypeScript's module resolution for directories checks these in order
// @see https://www.typescriptlang.org/docs/handbook/modules/theory.html#module-resolution
const TS_INDEX_FILES = [
  'index.ts',
  'index.tsx',
  'index.mts',
  'index.cts',
  'index.d.ts',
  'index.js',
  'index.jsx',
  'index.mjs',
  'index.cjs',
];

/**
 * Resolves tsconfig wildcard paths.
 *
 * In tsconfig.json, paths like `@features/*` → `libs/features/src/*` work as follows:
 * - The `*` captures a single path segment (the module name)
 * - When importing `@features/feature-a`, TypeScript captures `feature-a`
 * - It then replaces `*` in the value pattern: `libs/features/src/feature-a`
 *
 * For discovery, we find all directories at the wildcard position that TypeScript
 * would recognize as valid modules (directories with index files or package.json).
 *
// @see https://www.typescriptlang.org/docs/handbook/modules/theory.html#module-resolution
 */
export function resolveTsConfigWildcard(
  keyPattern: string,
  valuePattern: string,
  cwd: string,
): KeyValuePair[] {
  const normalizedPattern = valuePattern.replace(/^\.?\/+/, '');

  const asteriskIndex = normalizedPattern.indexOf('*');
  if (asteriskIndex === -1) {
    return [];
  }

  const prefix = normalizedPattern.substring(0, asteriskIndex);
  const suffix = normalizedPattern.substring(asteriskIndex + 1);

  const searchPath = path.join(cwd, prefix);

  let entries: string[];
  try {
    entries = fs.readdirSync(searchPath);
  } catch {
    return [];
  }

  const keys: KeyValuePair[] = [];

  for (const entry of entries) {
    const entryPath = path.join(searchPath, entry);

    let stats: fs.Stats;
    try {
      stats = fs.statSync(entryPath);
    } catch {
      continue;
    }

    if (!stats.isDirectory()) {
      // Skipping individual files, we only process modules
      continue;
    }

    let modulePath = path.join(prefix, entry, suffix).replace(/\\/g, '/');
    const fullPath = path.join(cwd, modulePath);

    let fullPathStats: fs.Stats;
    try {
      fullPathStats = fs.statSync(fullPath);
    } catch {
      continue;
    }

    const key = keyPattern.replace('*', entry);

    if (fullPathStats.isDirectory()) {
      const indexFile = TS_INDEX_FILES.find((indexFile) =>
        fs.existsSync(path.join(fullPath, indexFile)),
      );

      if (!indexFile) {
        logger.warn(
          `[shared-mappings] Internal lib '${key}' does not contain an entryPoint (barrel file).`,
        );
        continue;
      }
      modulePath = path.join(modulePath, indexFile);
    } else if (!fullPathStats.isFile()) {
      continue;
    }

    keys.push({
      key,
      value: modulePath,
    });
  }

  return keys;
}

/**
 * Resolves package.json exports wildcard patterns.
 *
 * In package.json exports, patterns like `./features/*.js` → `./src/features/*.js` work as follows:
 * - The `*` is a literal string replacement that can include path separators
 * - Importing `pkg/features/a/b.js` captures `a/b` and replaces `*` → `./src/features/a/b.js`
 * - This matches actual files, not directories
 *
 * @see https://nodejs.org/api/packages.html#subpath-patterns
 */
export function resolvePackageJsonExportsWildcard(
  keyPattern: string,
  valuePattern: string,
  cwd: string,
): KeyValuePair[] {
  const normalizedPattern = valuePattern.replace(/^\.?\/+/, '');

  const asteriskIndex = normalizedPattern.indexOf('*');
  if (asteriskIndex === -1) {
    return [];
  }

  const prefix = normalizedPattern.substring(0, asteriskIndex);
  const suffix = normalizedPattern.substring(asteriskIndex + 1);

  // fast-glob requires **/* pattern for matching files at any depth
  const files = fg.sync(prefix + '**/*' + suffix, {
    cwd,
    onlyFiles: true,
    deep: Infinity,
  });

  const keys: KeyValuePair[] = [];

  for (const file of files) {
    const relPath = file.replace(/\\/g, '/').replace(/^\.\//, '');

    const captured = suffix
      ? relPath.slice(prefix.length, -suffix.length)
      : relPath.slice(prefix.length);

    const key = keyPattern.replace('*', captured);

    keys.push({
      key,
      value: relPath,
    });
  }

  return keys;
}
