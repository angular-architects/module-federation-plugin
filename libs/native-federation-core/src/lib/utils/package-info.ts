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
    // TODO: Add logger
    // context.logger.warn('No version found for ' + packageName);
    logger.warn('No version found for ' + packageName);

    return null;
  }

  const pathToSecondary = path.relative(mainPkgName, packageName);
  const relSecondaryPath = !pathToSecondary
    ? '.'
    : './' + pathToSecondary.replace(/\\/g, '/');

  let secondaryEntryPoint = mainPkgJson?.exports?.[relSecondaryPath];

  // wildcard
  if (!secondaryEntryPoint) {
    const wildcardEntry = Object.keys(mainPkgJson?.exports ?? []).find((e) =>
      e.startsWith('./*'),
    );
    if (wildcardEntry) {
      secondaryEntryPoint = mainPkgJson?.exports?.[wildcardEntry];
      if (typeof secondaryEntryPoint === 'string')
        secondaryEntryPoint = secondaryEntryPoint.replace('*', pathToSecondary);
      if (typeof secondaryEntryPoint === 'object')
        Object.keys(secondaryEntryPoint).forEach(function (key) {
          secondaryEntryPoint[key] = secondaryEntryPoint[key].replace(
            '*',
            pathToSecondary,
          );
        });
    }
  }

  if (typeof secondaryEntryPoint === 'string') {
    return {
      entryPoint: path.join(mainPkgPath, secondaryEntryPoint),
      packageName,
      version,
      esm,
    };
  }

  let cand = secondaryEntryPoint?.import;

  if (typeof cand === 'object') {
    if (cand.module) {
      cand = cand.module;
    } else if (cand.import) {
      cand = cand.import;
    } else if (cand.default) {
      cand = cand.default;
    } else {
      cand = null;
    }
  }

  if (cand) {
    if (typeof cand === 'object') {
      if (cand.module) {
        cand = cand.module;
      } else if (cand.import) {
        cand = cand.import;
      } else if (cand.default) {
        cand = cand.default;
      } else {
        cand = null;
      }
    }

    return {
      entryPoint: path.join(mainPkgPath, cand),
      packageName,
      version,
      esm,
    };
  }

  cand = secondaryEntryPoint?.module;

  if (typeof cand === 'object') {
    if (cand.module) {
      cand = cand.module;
    } else if (cand.import) {
      cand = cand.import;
    } else if (cand.default) {
      cand = cand.default;
    } else {
      cand = null;
    }
  }

  if (cand) {
    return {
      entryPoint: path.join(mainPkgPath, cand),
      packageName,
      version,
      esm,
    };
  }

  cand = secondaryEntryPoint?.default;
  if (cand) {
    if (typeof cand === 'object') {
      if (cand.module) {
        cand = cand.module;
      } else if (cand.import) {
        cand = cand.import;
      } else if (cand.default) {
        cand = cand.default;
      } else {
        cand = null;
      }
    }

    return {
      entryPoint: path.join(mainPkgPath, cand),
      packageName,
      version,
      esm,
    };
  }

  cand = mainPkgJson['module'];

  if (cand && relSecondaryPath === '.') {
    return {
      entryPoint: path.join(mainPkgPath, cand),
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

  cand = path.join(secondaryPgkPath, 'index.mjs');
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

  // cand = secondaryPgkPath;
  // if (fs.existsSync(cand) && cand.match(/\.(m|c)?js$/)) {
  //   return {
  //     entryPoint: cand,
  //     packageName,
  //     version,
  //     esm,
  //   };
  // }

  // TODO: Add logger
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

// const pkg = process.argv[2]
// console.log('pkg', pkg);

// const r = getPackageInfo('D:/Dokumente/projekte/mf-plugin/angular-architects/', pkg);
// console.log('entry', r);
