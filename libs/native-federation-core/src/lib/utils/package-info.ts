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

export function findPackageJsonFiles(project: string, workspace: string): string[] {
  return expandFolders(project, workspace)
    .map(f => path.join(f, 'package.json'))
    .filter(f => fs.existsSync(f));
}

export function expandFolders(child: string, parent: string): string[] {
  const result: string[] = [];
  parent = normalize(parent, true);
  child = normalize(child, true);

  if (!child.startsWith(parent)) {
    throw new Error(`Workspace folder ${path} needs to be a parent of the project folder ${child}`);
  }

  let current = child;

  while (current !== parent) {
    result.push(current);
    
    const cand = normalize(path.dirname(current), true);
    if (cand === current) {
      break
    };
    current = cand;
  }
  result.push(parent);
  return result;
}

export function getPackageInfo(
  packageName: string,
  workspaceRoot: string,
  projectRoot: string
): PackageInfo | null {

  workspaceRoot = normalize(workspaceRoot, true);
  projectRoot = normalize(projectRoot, true);

  let currentPath = projectRoot;

  while (workspaceRoot !== currentPath) {

    const cand = _getPackageInfo(packageName, currentPath);
    if (cand) {
      return cand;
    }

    currentPath = normalize(path.dirname(currentPath), true);
  }

  const result = _getPackageInfo(packageName, currentPath);

  if (!result) {
    logger.warn('No meta data found for shared lib ' + packageName);
  }

  return result;

}

export function _getPackageInfo(
  packageName: string,
  currentPath: string,
): PackageInfo | null {


  const mainPkgName = getPkgFolder(packageName);

  const mainPkgPath = path.join(currentPath, 'node_modules', mainPkgName);
  const mainPkgJsonPath = path.join(mainPkgPath, 'package.json');

  if (!fs.existsSync(mainPkgPath)) {
    // TODO: Add logger
    // context.logger.warn('No package.json found for ' + packageName);
    logger.verbose('No package.json found for ' + packageName + ' in ' + mainPkgPath);

    return null;
  }

  const mainPkgJson = readJson(mainPkgJsonPath);

  const version = mainPkgJson['version'] as string;
  const esm = mainPkgJson['type'] === 'module';

  if (!version) {
    // TODO: Add logger
    // context.logger.warn('No version found for ' + packageName);
    logger.warn('No version found for ' + packageName);

    return null;
  }

  let relSecondaryPath = path.relative(mainPkgName, packageName);
  if (!relSecondaryPath) {
    relSecondaryPath = '.';
  } else {
    relSecondaryPath = './' + relSecondaryPath.replace(/\\/g, '/');
  }

  let cand = mainPkgJson?.exports?.[relSecondaryPath];

  if (typeof cand === 'string') {
    return {
        entryPoint: path.join(mainPkgPath, cand),
        packageName,
        version,
        esm,
    };
  }
  
  cand = mainPkgJson?.exports?.[relSecondaryPath]?.import;

  if (typeof cand === 'object') {
    if (cand.module) {
      cand = cand.module;
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

  cand = mainPkgJson?.exports?.[relSecondaryPath]?.default;
  if (cand) {
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

  const secondaryPgkPath = path.join(currentPath, 'node_modules', packageName);
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

  // TODO: Add logger
  logger.warn('No entry point found for ' + packageName);
  logger.warn(
    "If you don't need this package, skip it in your federation.config.js or consider moving it into depDependencies in your package.json"
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
