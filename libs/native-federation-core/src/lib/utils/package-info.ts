import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { normalize } from './normalize';

export interface PackageInfo {
  packageName: string;
  entryPoint: string;
  version: string;
  esm: boolean;
}

export interface PartialPackageJson {
  module: string;
  main: string;
}

export type VersionMap = Record<string, string>;

export type PackageJsonInfo = {
  content: any;
  directory: string;
};

export type ExportCondition =
  | 'import'
  | 'require'
  | 'node'
  | 'cjs'
  | 'esm'
  | 'default'
  | 'types'
  | 'browser'
  | (string & {});

export const isESMExport = (e: string): boolean | undefined => {
  if (e === 'node' || e === 'import' || e.startsWith('es')) return true;
  if (e === 'require' || e === 'cjs') return false;
  return undefined;
};

export type ExportEntry =
  | string
  | undefined
  | { [key in ExportCondition]?: ExportEntry }
  | ExportEntry[];

export type PackageJsonExports =
  | string
  | ExportEntry
  | { [path: `.${string}`]: ExportEntry };

const packageCache: Record<string, PackageJsonInfo[]> = {};

export function findPackageJsonFiles(
  project: string,
  workspace: string,
): string[] {
  return expandFolders(project, workspace)
    .map((f) => path.join(f, 'package.json'))
    .filter((f) => fs.existsSync(f));
}

export function expandFolders(child: string, parent: string): string[] {
  const result: string[] = [];
  parent = normalize(parent, true);
  child = normalize(child, true);

  if (!child.startsWith(parent)) {
    throw new Error(
      `Workspace folder ${path} needs to be a parent of the project folder ${child}`,
    );
  }

  let current = child;

  while (current !== parent) {
    result.push(current);

    const cand = normalize(path.dirname(current), true);
    if (cand === current) {
      break;
    }
    current = cand;
  }
  result.push(parent);
  return result;
}

export function getPackageInfo(
  packageName: string,
  workspaceRoot: string,
): PackageInfo | null {
  workspaceRoot = normalize(workspaceRoot, true);

  const packageJsonInfos = getPackageJsonFiles(workspaceRoot, workspaceRoot);

  for (const info of packageJsonInfos) {
    const cand = _getPackageInfo(packageName, info.directory);
    if (cand) {
      return cand;
    }
  }

  logger.warn('No meta data found for shared lib ' + packageName);
  return null;
}

function getVersionMapCacheKey(project: string, workspace: string): string {
  return `${project}**${workspace}`;
}

export function getVersionMaps(
  project: string,
  workspace: string,
): VersionMap[] {
  return getPackageJsonFiles(project, workspace).map((json) => ({
    ...json.content['dependencies'],
  }));
}

export function getPackageJsonFiles(
  project: string,
  workspace: string,
): PackageJsonInfo[] {
  const cacheKey = getVersionMapCacheKey(project, workspace);

  let maps = packageCache[cacheKey];

  if (maps) {
    return maps;
  }

  maps = findPackageJsonFiles(project, workspace).map((f) => {
    const content = JSON.parse(fs.readFileSync(f, 'utf-8'));
    const directory = normalize(path.dirname(f), true);
    const result: PackageJsonInfo = {
      content,
      directory,
    };
    return result;
  });

  packageCache[cacheKey] = maps;
  return maps;
}

export function findDepPackageJson(
  packageName: string,
  projectRoot: string,
): string | null {
  const mainPkgName = getPkgFolder(packageName);

  let mainPkgPath = path.join(projectRoot, 'node_modules', mainPkgName);
  let mainPkgJsonPath = path.join(mainPkgPath, 'package.json');

  let directory = projectRoot;

  while (path.dirname(directory) !== directory) {
    if (fs.existsSync(mainPkgJsonPath)) {
      break;
    }

    directory = normalize(path.dirname(directory), true);

    mainPkgPath = path.join(directory, 'node_modules', mainPkgName);
    mainPkgJsonPath = path.join(mainPkgPath, 'package.json');
  }

  if (!fs.existsSync(mainPkgJsonPath)) {
    // TODO: Add logger
    // context.logger.warn('No package.json found for ' + packageName);
    logger.verbose(
      'No package.json found for ' + packageName + ' in ' + mainPkgPath,
    );

    return null;
  }
  return mainPkgJsonPath;
}

function replaceGlob(target: ExportEntry, replacement: string): ExportEntry {
  if (!target) return undefined;
  if (typeof target === 'string') return target.replace('*', replacement);
  return Object.entries(target).reduce(
    (a, [k, v]) => ({
      ...a,
      [k]: replaceGlob(v!, replacement),
    }),
    {} as Omit<ExportEntry, string>,
  );
}

function findOptimalExport(
  target: ExportEntry,
  info: PackageInfo,
  isESM: boolean | undefined = undefined,
): PackageInfo | undefined {
  if (typeof target === 'string') {
    return {
      ...info,
      entryPoint: path.join(info.entryPoint, target),
      esm: isESM ?? info.esm,
    };
  }
  if (!target) return undefined;
  if (Array.isArray(target)) return findOptimalExport(target[0], info, isESM);

  const exportTypes = Object.keys(target);

  // We prefer ESM exports for native support.
  if (typeof isESM === 'undefined') {
    const esmExport = exportTypes.find((e) => isESMExport(e));
    if (esmExport) {
      return findOptimalExport(target[esmExport], info, true);
    }
  }

  // Node.js looks at the exports object and uses the first key that matches the current environment.
  const secondBestEntry =
    'default' in target && target['default']
      ? 'default'
      : exportTypes.filter((e) => e !== 'types')[0];
  const secondBestExport: ExportEntry = target[secondBestEntry];

  return findOptimalExport(
    secondBestExport,
    info,
    isESM ?? isESMExport(secondBestEntry),
  );
}

export function _getPackageInfo(
  packageName: string,
  directory: string,
): PackageInfo | null {
  const mainPkgName = getPkgFolder(packageName);
  const mainPkgJsonPath = findDepPackageJson(packageName, directory);

  if (!mainPkgJsonPath) {
    return null;
  }

  const mainPkgPath = path.dirname(mainPkgJsonPath);
  const mainPkgJson = readJson(mainPkgJsonPath);

  const version = mainPkgJson['version'] as string;
  const esm = mainPkgJson['type'] === 'module';

  if (!version) {
    logger.warn('No version found for ' + packageName);
    return null;
  }

  const pathToSecondary = path.relative(mainPkgName, packageName);
  const relSecondaryPath = !pathToSecondary
    ? '.'
    : './' + pathToSecondary.replace(/\\/g, '/');

  let secondaryEntryPoint: ExportEntry = undefined;

  const packageJsonExportsEntry = Object.keys(mainPkgJson?.exports ?? []).find(
    (e) => {
      if (e === relSecondaryPath) return true;
      if (e === './*') return true;
      if (!e.endsWith('*')) return false;
      const globPath = e.substring(0, e.length - 1);
      return relSecondaryPath.startsWith(globPath);
    },
  );

  if (packageJsonExportsEntry) {
    secondaryEntryPoint = mainPkgJson?.exports?.[packageJsonExportsEntry];

    if (packageJsonExportsEntry.endsWith('*')) {
      const replacement = relSecondaryPath.substring(
        packageJsonExportsEntry.length - 1,
      );
      secondaryEntryPoint = replaceGlob(secondaryEntryPoint, replacement);
    }
  }

  if (secondaryEntryPoint) {
    const info = findOptimalExport(secondaryEntryPoint, {
      entryPoint: mainPkgPath,
      packageName,
      version,
      esm,
    });
    if (info) return info;
  }

  if (mainPkgJson['module'] && relSecondaryPath === '.') {
    return {
      entryPoint: path.join(mainPkgPath, mainPkgJson['module']),
      packageName,
      version,
      esm: true,
    };
  }

  const secondaryPgkPath = path.join(mainPkgPath, relSecondaryPath);
  const secondaryPgkJsonPath = path.join(secondaryPgkPath, 'package.json');
  let secondaryPgkJson: PartialPackageJson | null = null;
  if (fs.existsSync(secondaryPgkJsonPath)) {
    secondaryPgkJson = readJson(secondaryPgkJsonPath);
  }

  if (secondaryPgkJson && secondaryPgkJson.module) {
    return {
      entryPoint: path.join(secondaryPgkPath, secondaryPgkJson.module),
      packageName,
      version,
      esm: true,
    };
  }

  let cand = path.join(secondaryPgkPath, 'index.mjs');
  if (fs.existsSync(cand)) {
    return {
      entryPoint: cand,
      packageName,
      version,
      esm: true,
    };
  }

  if (secondaryPgkJson && secondaryPgkJson.main) {
    return {
      entryPoint: path.join(secondaryPgkPath, secondaryPgkJson.main),
      packageName,
      version,
      esm,
    };
  }

  cand = path.join(secondaryPgkPath, 'index.js');
  if (fs.existsSync(cand)) {
    return {
      entryPoint: cand,
      packageName,
      version,
      esm,
    };
  }

  cand = secondaryPgkPath + '.js';
  if (fs.existsSync(cand)) {
    return {
      entryPoint: cand,
      packageName,
      version,
      esm,
    };
  }

  cand = secondaryPgkPath + '.mjs';
  if (fs.existsSync(cand)) {
    return {
      entryPoint: cand,
      packageName,
      version,
      esm,
    };
  }

  logger.warn('No entry point found for ' + packageName);
  logger.warn(
    "If you don't need this package, skip it in your federation.config.js or consider moving it into depDependencies in your package.json",
  );

  return null;
}

function readJson(mainPkgJsonPath: string) {
  return JSON.parse(fs.readFileSync(mainPkgJsonPath, 'utf-8'));
}

function getPkgFolder(packageName: string) {
  const parts = packageName.split('/');

  let folder = parts[0];

  if (folder.startsWith('@')) {
    folder += '/' + parts[1];
  }

  return folder;
}
