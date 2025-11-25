import { getProjectData, ProjectData } from '@softarc/sheriff-core';
import path from 'path';
import fs from 'fs';
import { cwd } from 'process';
import { NormalizedFederationConfig } from '../config/federation-config';
import { getPackageInfo, PackageInfo } from '../utils/package-info';
import { getExternalImports as extractExternalImports } from '../utils/get-external-imports';
import { MappedPath } from '../utils/mapped-paths';

export function removeUnusedDeps(
  config: NormalizedFederationConfig,
  main: string,
  workspaceRoot: string,
): NormalizedFederationConfig {
  const fileInfos = getProjectData(main, cwd(), {
    includeExternalLibraries: true,
  });

  const usedDeps = findUsedDeps(fileInfos, workspaceRoot, config);
  const usedPackageNames = usedDeps.usedPackageNames;
  const usedMappings = usedDeps.usedMappings;

  const usedPackageNamesWithTransient = addTransientDeps(
    usedPackageNames,
    workspaceRoot,
  );
  const filteredShared = filterShared(config, usedPackageNamesWithTransient);

  return {
    ...config,
    shared: filteredShared,
    sharedMappings: [...usedMappings],
  };
}

function filterShared(
  config: NormalizedFederationConfig,
  usedPackageNamesWithTransient: Set<string>,
) {
  const filteredSharedNames = Object.keys(config.shared).filter((shared) =>
    usedPackageNamesWithTransient.has(shared),
  );

  const filteredShared = filteredSharedNames.reduce(
    (acc, curr) => ({ ...acc, [curr]: config.shared[curr] }),
    {},
  );
  return filteredShared;
}

function findUsedDeps(
  fileInfos: ProjectData,
  workspaceRoot: string,
  config: NormalizedFederationConfig,
) {
  const usedPackageNames = new Set<string>();
  const usedMappings = new Set<MappedPath>();

  for (const fileName of Object.keys(fileInfos)) {
    const fileInfo = fileInfos[fileName];

    if (!fileInfo) {
      continue;
    }

    const libs = [
      ...(fileInfo.externalLibraries || []),
      ...(fileInfo.unresolvedImports || []),
    ];

    for (const pckg of libs) {
      usedPackageNames.add(pckg);
    }

    const fullFileName = path.join(workspaceRoot, fileName);
    const mappings = config.sharedMappings.filter((sm) =>
      fullFileName.startsWith(sm.path),
    );

    for (const mapping of mappings) {
      usedMappings.add(mapping);
    }
  }
  return { usedPackageNames, usedMappings };
}

function addTransientDeps(packages: Set<string>, workspaceRoot: string) {
  const packagesAndPeers = new Set<string>([...packages]);
  const discovered = new Set<string>(packagesAndPeers);
  const stack = [...packagesAndPeers];

  while (stack.length > 0) {
    const dep = stack.pop();

    if (!dep) {
      continue;
    }

    const pInfo = getPackageInfo(dep, workspaceRoot);

    if (!pInfo) {
      continue;
    }

    const peerDeps = getExternalImports(pInfo, workspaceRoot);

    for (const peerDep of peerDeps) {
      if (!discovered.has(peerDep)) {
        discovered.add(peerDep);
        stack.push(peerDep);
        packagesAndPeers.add(peerDep);
      }
    }
  }
  return packagesAndPeers;
}

function getExternalImports(pInfo: PackageInfo, workspaceRoot: string) {
  const encodedPackageName = pInfo.packageName.replace(/[^A-Za-z0-9]/g, '_');
  const cacheFileName = `${encodedPackageName}-${pInfo.version}.deps.json`;
  const cachePath = path.join(
    workspaceRoot,
    'node_modules/.cache/native-federation',
  );
  const cacheFilePath = path.join(cachePath, cacheFileName);

  const cacheHit = fs.existsSync(cacheFilePath);

  let peerDeps;
  if (cacheHit) {
    peerDeps = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'));
  } else {
    peerDeps = extractExternalImports(pInfo.entryPoint);
    fs.mkdirSync(cachePath, { recursive: true });
    fs.writeFileSync(
      cacheFilePath,
      JSON.stringify(peerDeps, undefined, 2),
      'utf-8',
    );
  }
  return peerDeps;
}
