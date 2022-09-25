import * as path from 'path';
import * as fs from 'fs';
import { NormalizedFederationConfig } from '../config/federation-config';
import { bundle } from '../utils/build-utils';
import { getPackageInfo, PackageInfo } from '../utils/package-info';
import { SharedInfo } from '@softarc/native-federation-runtime';
import { FederationOptions } from './federation-options';
import { copySrcMapIfExists } from '../utils/copy-src-map-if-exists';
import { logger } from '../utils/logger';
import { hashFile } from '../utils/hash-file';
import { normalize } from '../utils/normalize';

export async function bundleShared(
  config: NormalizedFederationConfig,
  fedOptions: FederationOptions,
  externals: string[]
): Promise<Array<SharedInfo>> {
  const result: Array<SharedInfo> = [];
  const packageInfos = Object.keys(config.shared)
    // .filter((packageName) => !isInSkipList(packageName, PREPARED_DEFAULT_SKIP_LIST))
    .map((packageName) => getPackageInfo(packageName, fedOptions.workspaceRoot))
    .filter((pi) => !!pi) as PackageInfo[];

  // logger.notice('Shared packages are only bundled once as they are cached');
  // logger.notice(
  //   'Make sure, you skip all unneeded packages in your federation.config.js!'
  // );

  const federationConfigPath = path.join(
    fedOptions.workspaceRoot,
    fedOptions.federationConfig
  );
  const hash = hashFile(federationConfigPath);

  let first = true;
  for (const pi of packageInfos) {
    // logger.info('Bundling shared package ' + pi.packageName);

    const encName = pi.packageName.replace(/[^A-Za-z0-9]/g, '_');
    const encVersion = pi.version.replace(/[^A-Za-z0-9]/g, '_');

    const outFileName = `${encName}-${encVersion}-${hash}.js`;

    const cachePath = path.join(
      fedOptions.workspaceRoot,
      'node_modules/.cache/native-federation'
    );

    fs.mkdirSync(cachePath, { recursive: true });

    const cachedFile = path.join(cachePath, outFileName);

    if (!fs.existsSync(cachedFile)) {
      if (first) {
        logger.notice('Preparing shared npm packages');
        logger.notice('This only needs to be done once');
        logger.notice(
          "Skip packages you don't want to share in your federation config"
        );
      }
      first = false;

      logger.info('Preparing shared package ' + pi.packageName);

      try {
        await bundle({
          entryPoint: pi.entryPoint,
          tsConfigPath: fedOptions.tsConfig,
          external: externals,
          outfile: cachedFile,
          mappedPaths: config.sharedMappings,
          packageName: pi.packageName,
          esm: pi.esm,
          kind: 'shared-package',
        });
      } catch (e) {
        logger.error('Error bundling npm package ' + pi.packageName);
        if (e instanceof Error) {
          logger.error(e.message);
        }
        logger.error('For more information, run in verbose mode');
        logger.notice(
          `If you don't need this package, skip it in your federation.config.js!`
        );
        logger.verbose(e);
        continue;
      }
    }

    const shared = config.shared[pi.packageName];

    result.push({
      packageName: pi.packageName,
      outFileName: outFileName,
      requiredVersion: shared.requiredVersion,
      singleton: shared.singleton,
      strictVersion: shared.strictVersion,
      version: pi.version,
      dev: !fedOptions.dev
        ? undefined
        : {
            entryPoint: normalize(pi.entryPoint),
          },
    });

    const fullOutputPath = path.join(
      fedOptions.workspaceRoot,
      fedOptions.outputPath,
      outFileName
    );

    copyFileIfExists(cachedFile, fullOutputPath);
    copySrcMapIfExists(cachedFile, fullOutputPath);
  }

  return result;
}

function copyFileIfExists(cachedFile: string, fullOutputPath: string) {
  fs.mkdirSync(path.dirname(fullOutputPath), { recursive: true });

  if (fs.existsSync(cachedFile)) {
    fs.copyFileSync(cachedFile, fullOutputPath);
  }
}
