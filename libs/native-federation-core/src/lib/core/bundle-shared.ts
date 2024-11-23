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
import crypto from 'crypto';

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

  const configState =
    fs.readFileSync(path.join(__dirname, '../../../package.json')) +
    JSON.stringify(config);

  const allEntryPoints = packageInfos.map((pi) => {
    const encName = pi.packageName.replace(/[^A-Za-z0-9]/g, '_');
    // const encVersion = pi.version.replace(/[^A-Za-z0-9]/g, '_');

    // const outName = fedOptions.dev
    //   ? `${encName}-${encVersion}-dev.js`
    //   : `${encName}-${encVersion}.js`;

    const hash = calcHash(pi, configState);

    const outName = fedOptions.dev
      ? `${encName}.${hash}-dev.js`
      : `${encName}.${hash}.js`;

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

    logger.notice('');
    logger.notice('');

    logger.notice('** Important Information: ***');
    logger.notice(
      'The error message above shows an issue with bundling a node_module.'
    );
    logger.notice(
      'In most cases this is because you (indirectly) shared a Node.js package,'
    );
    logger.notice('while Native Federation builds for the browser.');
    logger.notice(
      'You can move such packages into devDependencies or skip them in your federation.config.js.'
    );
    logger.notice('');
    logger.notice('More Details: https://bit.ly/nf-issue');

    logger.notice('');
    logger.notice('');

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

function calcHash(pi: PackageInfo, configState: string) {
  const hashBase = pi.version + '_' + pi.entryPoint + '_' + configState;
  const hash = crypto
    .createHash('sha256')
    .update(hashBase)
    .digest('base64')
    .replace(/\//g, '_')
    .replace(/\+/g, '-')
    .replace(/=/g, '')
    .substring(0, 10);
  return hash;
}

function copyFileIfExists(cachedFile: string, fullOutputPath: string) {
  fs.mkdirSync(path.dirname(fullOutputPath), { recursive: true });

  if (fs.existsSync(cachedFile)) {
    fs.copyFileSync(cachedFile, fullOutputPath);
  }
}
