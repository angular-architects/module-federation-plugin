import * as path from 'path';
import * as fs from 'fs';
import { NormalizedFederationConfig } from '../config/federation-config';
import { bundle } from '../utils/build-utils';
import { getPackageInfo, PackageInfo } from '../utils/package-info';
import { SharedInfo } from '@softarc/native-federation-runtime';
import { FederationOptions } from './federation-options';
import { copySrcMapIfExists } from '../utils/copy-src-map-if-exists';
import { logger } from '../utils/logger';
import { normalize } from '../utils/normalize';

export async function bundleShared(
  config: NormalizedFederationConfig,
  fedOptions: FederationOptions,
  externals: string[]
): Promise<Array<SharedInfo>> {
  const folder = fedOptions.packageJson
    ? path.dirname(fedOptions.packageJson)
    : fedOptions.workspaceRoot;

  const cachePath = path.join(
    fedOptions.workspaceRoot,
    'node_modules/.cache/native-federation'
  );

  fs.mkdirSync(cachePath, { recursive: true });

  const packageInfos = Object.keys(config.shared)
    // .filter((packageName) => !isInSkipList(packageName, PREPARED_DEFAULT_SKIP_LIST))
    .map((packageName) => getPackageInfo(packageName, folder))
    .filter((pi) => !!pi) as PackageInfo[];

  const allEntryPoints = packageInfos.map((pi) => {
    const encName = pi.packageName.replace(/[^A-Za-z0-9]/g, '_');
    const encVersion = pi.version.replace(/[^A-Za-z0-9]/g, '_');

    const outName = fedOptions.dev
      ? `${encName}-${encVersion}-dev.js`
      : `${encName}-${encVersion}.js`;

    return { fileName: pi.entryPoint, outName };
  });

  const fullOutputPath = path.join(
    fedOptions.workspaceRoot,
    fedOptions.outputPath
  );

  const exptedResults = allEntryPoints.map((ep) =>
    path.join(fullOutputPath, ep.outName)
  );
  const entryPoints = allEntryPoints.filter(
    (ep) => !fs.existsSync(path.join(cachePath, ep.outName))
  );

  if (entryPoints.length > 0) {
    logger.info('Preparing shared npm packages');
    logger.notice('This only needs to be done once, as results are cached');
    logger.notice(
      "Skip packages you don't want to share in your federation config"
    );
  }

  try {
    await bundle({
      entryPoints,
      tsConfigPath: fedOptions.tsConfig,
      external: externals,
      outdir: cachePath,
      mappedPaths: config.sharedMappings,
      dev: fedOptions.dev,
      kind: 'shared-package',
      hash: false,
    });

    for (const fileName of exptedResults) {
      const outFileName = path.basename(fileName);
      const cachedFile = path.join(cachePath, outFileName);

      copyFileIfExists(cachedFile, fileName);
      copySrcMapIfExists(cachedFile, fileName);
    }
  } catch (e) {
    logger.error('Error bundling shared npm package ');
    if (e instanceof Error) {
      logger.error(e.message);
    }
    logger.error('For more information, run in verbose mode');
    logger.notice(
      `If you don't need this package, skip it in your federation.config.js!`
    );
    logger.verbose(e);
  }

  const outFileNames = [...exptedResults];

  return packageInfos.map((pi) => {
    const shared = config.shared[pi.packageName];
    return {
      packageName: pi.packageName,
      outFileName: path.basename(outFileNames.shift() || ''),
      requiredVersion: shared.requiredVersion,
      singleton: shared.singleton,
      strictVersion: shared.strictVersion,
      version: pi.version,
      dev: !fedOptions.dev
        ? undefined
        : {
            entryPoint: normalize(pi.entryPoint),
          },
    } as SharedInfo;
  });
}

function copyFileIfExists(cachedFile: string, fullOutputPath: string) {
  fs.mkdirSync(path.dirname(fullOutputPath), { recursive: true });

  if (fs.existsSync(cachedFile)) {
    fs.copyFileSync(cachedFile, fullOutputPath);
  }
}
