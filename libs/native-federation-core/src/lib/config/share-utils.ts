import path = require('path');
import fs = require('fs');
import { cwd } from 'process';
import { SharedConfig } from './federation-config';
import {
  DEFAULT_SKIP_LIST,
  isInSkipList,
  PreparedSkipList,
  prepareSkipList,
  SkipList,
} from '../core/default-skip-list';
import {
  findDepPackageJson,
  getVersionMaps,
  VersionMap,
} from '../utils/package-info';
import { getConfigContext } from './configuration-context';
import { logger } from '../utils/logger';

import {
  KeyValuePair,
  resolveWildcardKeys,
} from '../utils/resolve-wildcard-keys';

let inferVersion = false;

export const DEFAULT_SECONDARIES_SKIP_LIST = [
  '@angular/router/upgrade',
  '@angular/common/upgrade',
];

type IncludeSecondariesOptions = { skip: string | string[] } | boolean;
type CustomSharedConfig = SharedConfig & {
  includeSecondaries?: IncludeSecondariesOptions;
};
type ConfigObject = Record<string, CustomSharedConfig>;
type Config = (string | ConfigObject)[] | ConfigObject;

export function findRootTsConfigJson(): string {
  const packageJson = findPackageJson(cwd());
  const projectRoot = path.dirname(packageJson);
  const tsConfigBaseJson = path.join(projectRoot, 'tsconfig.base.json');
  const tsConfigJson = path.join(projectRoot, 'tsconfig.json');

  if (fs.existsSync(tsConfigBaseJson)) {
    return tsConfigBaseJson;
  } else if (fs.existsSync(tsConfigJson)) {
    return tsConfigJson;
  }

  throw new Error('Neither a tsconfig.json nor a tsconfig.base.json was found');
}

function findPackageJson(folder: string): string {
  while (
    !fs.existsSync(path.join(folder, 'package.json')) &&
    path.dirname(folder) !== folder
  ) {
    folder = path.dirname(folder);
  }

  const filePath = path.join(folder, 'package.json');
  if (fs.existsSync(filePath)) {
    return filePath;
  }

  throw new Error(
    'no package.json found. Searched the following folder and all parents: ' +
      folder
  );
}

function lookupVersion(key: string, workspaceRoot: string): string {
  const versionMaps = getVersionMaps(workspaceRoot, workspaceRoot);

  for (const versionMap of versionMaps) {
    const version = lookupVersionInMap(key, versionMap);

    if (version) {
      return version;
    }
  }

  throw new Error(
    `Shared Dependency ${key} has requiredVersion:'auto'. However, this dependency is not found in your package.json`
  );
}

function lookupVersionInMap(key: string, versions: VersionMap): string | null {
  const parts = key.split('/');
  if (parts.length >= 2 && parts[0].startsWith('@')) {
    key = parts[0] + '/' + parts[1];
  } else {
    key = parts[0];
  }

  if (key.toLowerCase() === '@angular-architects/module-federation-runtime') {
    key = '@angular-architects/module-federation';
  }

  if (!versions[key]) {
    return null;
  }
  return versions[key];
}

function _findSecondaries(
  libPath: string,
  excludes: string[],
  shareObject: SharedConfig,
  acc: Record<string, SharedConfig>,
  preparedSkipList: PreparedSkipList
): void {
  const files = fs.readdirSync(libPath);

  const secondaries = files
    .map((f) => path.join(libPath, f))
    .filter(
      (f) => fs.lstatSync(f).isDirectory() && !f.endsWith('node_modules')
    );

  for (const s of secondaries) {
    if (fs.existsSync(path.join(s, 'package.json'))) {
      const secondaryLibName = s
        .replace(/\\/g, '/')
        .replace(/^.*node_modules[/]/, '');
      if (excludes.includes(secondaryLibName)) {
        continue;
      }

      if (isInSkipList(secondaryLibName, preparedSkipList)) {
        continue;
      }

      acc[secondaryLibName] = { ...shareObject };
    }

    _findSecondaries(s, excludes, shareObject, acc, preparedSkipList);
  }
}

function findSecondaries(
  libPath: string,
  excludes: string[],
  shareObject: SharedConfig,
  preparedSkipList: PreparedSkipList
): Record<string, SharedConfig> {
  const acc = {} as Record<string, SharedConfig>;
  _findSecondaries(libPath, excludes, shareObject, acc, preparedSkipList);
  return acc;
}

function getSecondaries(
  includeSecondaries: IncludeSecondariesOptions,
  libPath: string,
  key: string,
  shareObject: SharedConfig,
  preparedSkipList: PreparedSkipList
): Record<string, SharedConfig> | null {
  let exclude = [...DEFAULT_SECONDARIES_SKIP_LIST];

  if (typeof includeSecondaries === 'object') {
    if (Array.isArray(includeSecondaries.skip)) {
      exclude = includeSecondaries.skip;
    } else if (typeof includeSecondaries.skip === 'string') {
      exclude = [includeSecondaries.skip];
    }
  }

  // const libPath = path.join(path.dirname(packagePath), 'node_modules', key);

  if (!fs.existsSync(libPath)) {
    return {};
  }

  const configured = readConfiguredSecondaries(
    key,
    libPath,
    exclude,
    shareObject,
    preparedSkipList
  );
  if (configured) {
    return configured;
  }

  // Fallback: Search folders
  const secondaries = findSecondaries(
    libPath,
    exclude,
    shareObject,
    preparedSkipList
  );
  return secondaries;
}

function readConfiguredSecondaries(
  parent: string,
  libPath: string,
  exclude: string[],
  shareObject: SharedConfig,
  preparedSkipList: PreparedSkipList
): Record<string, SharedConfig> | null {
  const libPackageJson = path.join(libPath, 'package.json');

  if (!fs.existsSync(libPackageJson)) {
    return null;
  }

  const packageJson = JSON.parse(fs.readFileSync(libPackageJson, 'utf-8'));

  const version = packageJson['version'] as string;
  const esm = packageJson['type'] === 'module';

  const exports = packageJson['exports'] as Record<
    string,
    Record<string, string>
  >;

  if (!exports) {
    return null;
  }

  const keys = Object.keys(exports).filter(
    (key) =>
      key != '.' &&
      key != './package.json' &&
      key.startsWith('./') &&
      (exports[key]['default'] ||
        exports[key]['import'] ||
        typeof exports[key] === 'string')
  );

  const result = {} as Record<string, SharedConfig>;
  const discoveredFiles = new Set<string>();

  for (const key of keys) {
    const secondaryName = path.join(parent, key).replace(/\\/g, '/');

    if (exclude.includes(secondaryName)) {
      continue;
    }

    if (isInSkipList(secondaryName, preparedSkipList)) {
      continue;
    }

    const entry = getDefaultEntry(exports, key);

    if (typeof entry !== 'string') {
      console.log('No entry point found for ' + secondaryName);
      continue;
    }

    if (
      !entry?.endsWith('.js') &&
      !entry?.endsWith('.mjs') &&
      !entry?.endsWith('.cjs')
    ) {
      continue;
    }

    const items = resolveSecondaries(
      key,
      libPath,
      parent,
      secondaryName,
      entry,
      { discovered: discoveredFiles, skip: exclude }
    );
    items.forEach((e) =>
      discoveredFiles.add(typeof e === 'string' ? e : e.value)
    );

    for (const item of items) {
      if (typeof item === 'object') {
        result[item.key] = {
          ...shareObject,
          packageInfo: {
            entryPoint: item.value,
            version: shareObject.version ?? version,
            esm,
          },
        };
      } else {
        result[item] = {
          ...shareObject,
        };
      }
    }
  }

  return result;
}

function resolveSecondaries(
  key: string,
  libPath: string,
  parent: string,
  secondaryName: string,
  entry: string,
  excludes: { discovered: Set<string>; skip: string[] }
): Array<string | KeyValuePair> {
  let items: Array<string | KeyValuePair> = [];
  if (key.includes('*')) {
    const expanded = resolveWildcardKeys(key, entry, libPath);
    items = expanded
      .map((e) => ({
        key: path.join(parent, e.key),
        value: path.join(libPath, e.value),
      }))
      .filter((i) => {
        if (
          excludes.skip.some((e) =>
            e.endsWith('*') ? i.key.startsWith(e.slice(0, -1)) : e === i.key
          )
        ) {
          return false;
        }
        if (excludes.discovered.has(i.value)) {
          return false;
        }
        return true;
      });
  } else {
    items = [secondaryName];
  }
  return items;
}

function getDefaultEntry(
  exports: Record<string, Record<string, string>>,
  key: string
) {
  let entry = '';
  if (typeof exports[key] === 'string') {
    entry = exports[key] as unknown as string;
  }

  if (!entry) {
    entry = exports[key]?.['default'];
    if (typeof entry === 'object') {
      entry = entry['default'];
    }
  }

  if (!entry) {
    entry = exports[key]?.['import'];
    if (typeof entry === 'object') {
      entry = entry['import'] ?? entry['default'];
    }
  }

  if (!entry) {
    entry = exports[key]?.['require'];
    if (typeof entry === 'object') {
      entry = entry['require'] ?? entry['default'];
    }
  }

  return entry;
}

export function shareAll(
  config: CustomSharedConfig = {},
  skip: SkipList = DEFAULT_SKIP_LIST,
  projectPath = ''
): Config | null {
  // let workspacePath: string | undefined = undefined;

  projectPath = inferProjectPath(projectPath);

  // workspacePath = getConfigContext().workspaceRoot ?? '';

  // if (!workspacePath) {
  //   workspacePath = projectPath;
  // }

  const versionMaps = getVersionMaps(projectPath, projectPath);
  const share: Record<string, unknown> = {};
  const preparedSkipList = prepareSkipList(skip);

  for (const versions of versionMaps) {
    for (const key in versions) {
      if (isInSkipList(key, preparedSkipList)) {
        continue;
      }

      const inferVersion =
        !config.requiredVersion || config.requiredVersion === 'auto';
      const requiredVersion = inferVersion
        ? versions[key]
        : config.requiredVersion;

      if (!share[key]) {
        share[key] = { ...config, requiredVersion };
      }
    }
  }

  return module.exports.share(share, projectPath, skip);
}

function inferProjectPath(projectPath: string) {
  if (!projectPath && getConfigContext().packageJson) {
    projectPath = path.dirname(getConfigContext().packageJson || '');
  }

  if (!projectPath && getConfigContext().workspaceRoot) {
    projectPath = getConfigContext().workspaceRoot || '';
  }

  if (!projectPath) {
    projectPath = cwd();
  }
  return projectPath;
}

export function setInferVersion(infer: boolean): void {
  inferVersion = infer;
}

type TransientDependency = {
  packageName: string;
  requiredVersion: string;
  packagePath: string;
};

function findTransientDeps(
  configuredShareObjects: Config,
  projectRoot: string,
  preparedSkipList: PreparedSkipList
): TransientDependency[] {
  const discovered = new Set<string>();
  const result: TransientDependency[] = [];

  const packageNames = Object.keys(configuredShareObjects) as Array<
    keyof typeof configuredShareObjects
  >;

  for (const packageName of packageNames) {
    const shareConfig = configuredShareObjects[packageName];

    if (typeof shareConfig === 'object' && shareConfig.transient) {
      logger.warn(
        'PLEASE NOTE: The transient flag in your federation.config.js'
      );
      logger.warn(
        'is deprecated. Please remove it. Meanwhile, Native Federation'
      );
      logger.warn('uses the underlying bundler for splitting transient');
      logger.warn('dependencies into separate chunks, _when_ necessary.');
      const packagePath = path.join(
        projectRoot,
        'node_modules',
        packageName,
        'package.json'
      );
      _findTransientDeps(
        packagePath,
        projectRoot,
        preparedSkipList,
        discovered,
        result
      );
    }
  }

  return result;
}

function _findTransientDeps(
  packagePath: string,
  projectRoot: string,
  preparedSkipList: PreparedSkipList,
  discovered: Set<string>,
  result: TransientDependency[]
) {
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

  const deps = Object.keys(packageJson.dependencies ?? {});
  for (const dep of deps) {
    const depPackageJson = path.join(
      projectRoot,
      'node_modules',
      dep,
      'package.json'
    );
    const depPath = path.dirname(depPackageJson);

    if (
      !discovered.has(depPackageJson) &&
      !isInSkipList(dep, preparedSkipList) &&
      fs.existsSync(depPackageJson)
    ) {
      discovered.add(depPackageJson);
      const version = packageJson.dependencies[dep];
      result.push({
        packageName: dep,
        requiredVersion: version,
        packagePath: depPath,
      });
      _findTransientDeps(
        depPackageJson,
        projectRoot,
        preparedSkipList,
        discovered,
        result
      );
    }
  }
}

export function share(
  configuredShareObjects: Config,
  projectPath = '',
  skipList = DEFAULT_SKIP_LIST
): Config {
  projectPath = inferProjectPath(projectPath);
  const packagePath = findPackageJson(projectPath);

  const packageDirectory = path.dirname(packagePath);

  const preparedSkipList = prepareSkipList(skipList);

  const transientDeps = findTransientDeps(
    configuredShareObjects,
    packageDirectory,
    preparedSkipList
  );

  const transientShareObject = transientDeps.reduce(
    (acc, curr) => ({
      ...acc,
      [curr.packageName]: { path: curr.packagePath },
    }),
    {}
  );

  const shareObjects = {
    ...configuredShareObjects,
    ...transientShareObject,
  };

  const result: any = {};
  let includeSecondaries;

  for (const key in shareObjects) {
    includeSecondaries = false;
    const shareObject = (shareObjects as any)[key];

    if (
      shareObject.requiredVersion === 'auto' ||
      (inferVersion && typeof shareObject.requiredVersion === 'undefined')
    ) {
      const version = lookupVersion(key, projectPath);

      shareObject.requiredVersion = version;
      shareObject.version = version.replace(/^\D*/, '');
    }

    if (typeof shareObject.includeSecondaries === 'undefined') {
      shareObject.includeSecondaries = true;
    }

    if (shareObject.includeSecondaries) {
      includeSecondaries = shareObject.includeSecondaries;
      delete shareObject.includeSecondaries;
    }

    result[key] = shareObject;

    if (includeSecondaries) {
      const libPackageJson = findDepPackageJson(key, path.dirname(packagePath));

      if (!libPackageJson) {
        logger.error('Could not find folder containing dep ' + key);
        continue;
      }

      const libPath = path.dirname(libPackageJson);

      const secondaries = getSecondaries(
        includeSecondaries,
        libPath,
        key,
        shareObject,
        preparedSkipList
      );
      if (secondaries) {
        addSecondaries(secondaries, result);
      }
    }
  }

  return result;
}

function addSecondaries(
  secondaries: Record<string, SharedConfig>,
  result: Record<string, SharedConfig>
) {
  for (const key in secondaries) {
    result[key] = secondaries[key];
  }
}
