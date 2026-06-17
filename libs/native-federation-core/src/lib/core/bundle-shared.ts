import * as path from 'path';
import * as fs from 'fs';
import {
  NormalizedFederationConfig,
  NormalizedSharedConfig,
} from '../config/federation-config';
import { bundle } from '../utils/build-utils';
import { getPackageInfo, PackageInfo } from '../utils/package-info';
import { SharedInfo } from '@softarc/native-federation-runtime';
import { FederationOptions } from './federation-options';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { DEFAULT_EXTERNAL_LIST } from './default-external-list';
import { BuildResult } from './build-adapter';
import {
  deriveInternalName,
  isSourceFile,
  rewriteChunkImports,
} from '../utils/rewrite-chunk-imports';
import {
  cacheEntry,
  getChecksum,
  getFilename,
} from './../utils/bundle-caching';
import { contentHashedName } from '../utils/content-hashed-name';

export async function bundleShared(
  sharedBundles: Record<string, NormalizedSharedConfig>,
  config: NormalizedFederationConfig,
  fedOptions: FederationOptions,
  externals: string[],
  platform: 'browser' | 'node' = 'browser',
  cacheOptions: { pathToCache: string; bundleName: string },
): Promise<Array<SharedInfo>> {
  const checksum = getChecksum(sharedBundles, fedOptions.dev ? '1' : '0');
  const folder = fedOptions.packageJson
    ? path.dirname(fedOptions.packageJson)
    : fedOptions.workspaceRoot;

  const bundleCache = cacheEntry(
    cacheOptions.pathToCache,
    getFilename(cacheOptions.bundleName, fedOptions.dev),
  );

  if (fedOptions?.cacheExternalArtifacts) {
    const cacheMetadata = bundleCache.getMetadata(checksum);
    if (cacheMetadata) {
      logger.debug(
        `Checksum of ${cacheOptions.bundleName} matched, Skipped artifact bundling`,
      );
      bundleCache.copyFiles(
        path.join(fedOptions.workspaceRoot, fedOptions.outputPath),
      );
      return cacheMetadata.externals;
    }
  }

  bundleCache.clear();

  const inferredPackageInfos = Object.keys(sharedBundles)
    .filter((packageName) => !sharedBundles[packageName].packageInfo)
    .map((packageName) => getPackageInfo(packageName, folder))
    .filter((pi) => !!pi) as PackageInfo[];

  const configuredPackageInfos = Object.keys(sharedBundles)
    .filter((packageName) => !!sharedBundles[packageName].packageInfo)
    .map((packageName) => ({
      packageName,
      ...sharedBundles[packageName].packageInfo,
    })) as PackageInfo[];

  const packageInfos = [...inferredPackageInfos, ...configuredPackageInfos];

  const configState =
    'BUNDLER_CHUNKS' + // TODO: Replace this with lib version
    fs.readFileSync(path.join(__dirname, '../../../package.json')) +
    JSON.stringify(config);

  const allEntryPoints = packageInfos.map((pi) => {
    const encName = pi.packageName.replace(/[^A-Za-z0-9]/g, '_');
    const outName = createOutName(pi, configState, fedOptions, encName);
    return { fileName: pi.entryPoint, outName };
  });

  const fullOutputPath = path.join(
    fedOptions.workspaceRoot,
    fedOptions.outputPath,
  );

  // In production always rebuild the shared entries so they stay consistent with the
  // freshly built (content-hashed) chunk graph. The filename-existence shortcut below
  // is content-blind: because the entry name is derived from the package version (see
  // createOutName), a previously cached entry could be reused even though the chunks it
  // imports have been renamed, yielding a dist that references chunks it never emitted.
  const entryPoints = fedOptions.dev
    ? allEntryPoints.filter(
        (ep) => !fs.existsSync(path.join(cacheOptions.pathToCache, ep.outName)),
      )
    : allEntryPoints;

  // If we build for the browser and don't remote unused deps from the shared config,
  // we need to exclude typical node libs to avoid compilation issues
  const useDefaultExternalList =
    platform === 'browser' && !config.features.ignoreUnusedDeps;

  const additionalExternals = useDefaultExternalList
    ? DEFAULT_EXTERNAL_LIST
    : [];

  let bundleResult: BuildResult[] | null = null;

  try {
    bundleResult = await bundle({
      entryPoints,
      tsConfigPath: fedOptions.tsConfig,
      external: [...additionalExternals, ...externals],
      outdir: cacheOptions.pathToCache,
      mappedPaths: config.sharedMappings,
      dev: fedOptions.dev,
      kind: 'shared-package',
      hash: false,
      platform,
      optimizedMappings: config.features.ignoreUnusedDeps,
    });

    const cachedFiles = bundleResult.map((br) => path.basename(br.fileName));
    rewriteImports(cachedFiles, cacheOptions.pathToCache);

    // Re-hash each shared entry from its FINAL content (after import rewriting) so the
    // file name changes if and only if the content changes. createOutName() derives the
    // name from the package version only, which is not a content key once the shared
    // chunk graph shifts. Chunks are already content-hashed by the bundler, so we leave
    // them untouched. Skipped in dev to keep watch/HMR file names stable.
    if (!fedOptions.dev) {
      for (const ep of allEntryPoints) {
        const oldPath = path.join(cacheOptions.pathToCache, ep.outName);
        if (!fs.existsSync(oldPath)) {
          continue;
        }
        const newName = contentHashedName(ep.outName, fs.readFileSync(oldPath));
        if (newName === ep.outName) {
          continue;
        }
        fs.renameSync(oldPath, path.join(cacheOptions.pathToCache, newName));
        const mapOld = `${oldPath}.map`;
        if (fs.existsSync(mapOld)) {
          fs.renameSync(
            mapOld,
            path.join(cacheOptions.pathToCache, `${newName}.map`),
          );
        }
        // Keep bundleResult in sync so chunk detection and the persisted file list
        // (used by copyFiles) reference the new name.
        for (const br of bundleResult) {
          const baseName = path.basename(br.fileName);
          if (baseName === ep.outName || baseName === `${ep.outName}.map`) {
            br.fileName = path.join(
              path.dirname(br.fileName),
              baseName.replace(ep.outName, newName),
            );
          }
        }
        ep.outName = newName;
      }
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
      'The error message above shows an issue with bundling a node_module.',
    );
    logger.notice(
      'In most cases this is because you (indirectly) shared a Node.js package,',
    );
    logger.notice('while Native Federation builds for the browser.');
    logger.notice(
      'You can move such packages into devDependencies or skip them in your federation.config.js.',
    );
    logger.notice('');
    logger.notice('More Details: https://bit.ly/nf-issue');

    logger.notice('');
    logger.notice('');

    logger.verbose(e);
    throw e;
  }

  const outFileNames = allEntryPoints.map((ep) =>
    path.join(fullOutputPath, ep.outName),
  );

  const result = buildResult(packageInfos, sharedBundles, outFileNames);

  // TODO: Decide whether/when to add .map files
  const chunks = bundleResult.filter(
    (br) =>
      !br.fileName.endsWith('.map') &&
      !result.find((r) => r.outFileName === path.basename(br.fileName)),
  );

  addChunksToResult(chunks, result, fedOptions.dev);

  bundleCache.persist({
    checksum,
    externals: result,
    files: bundleResult.map(
      (r) => r.fileName.split(path.sep).pop() ?? r.fileName,
    ),
  });

  bundleCache.copyFiles(
    path.join(fedOptions.workspaceRoot, fedOptions.outputPath),
  );

  return result;
}

function rewriteImports(cachedFiles: string[], cachePath: string) {
  const newSourceFiles = cachedFiles.filter((cf) => isSourceFile(cf));

  for (const sourceFile of newSourceFiles) {
    const sourceFilePath = path.join(cachePath, sourceFile);
    rewriteChunkImports(sourceFilePath);
  }
}

function createOutName(
  pi: PackageInfo,
  configState: string,
  fedOptions: FederationOptions,
  encName: string,
) {
  const hashBase = pi.version + '_' + pi.entryPoint + '_' + configState;
  const hash = calcHash(hashBase);

  const outName = fedOptions.dev
    ? `${encName}.${hash}-dev.js`
    : `${encName}.${hash}.js`;
  return outName;
}

function buildResult(
  packageInfos: PackageInfo[],
  sharedBundles: Record<string, NormalizedSharedConfig>,
  outFileNames: string[],
) {
  return packageInfos.map((pi) => {
    const shared = sharedBundles[pi.packageName];
    return {
      packageName: pi.packageName,
      outFileName: path.basename(outFileNames.shift() || ''),
      requiredVersion: shared.requiredVersion,
      singleton: shared.singleton,
      strictVersion: shared.strictVersion,
      version: pi.version,
      // TODO: Decide whether/when we need debug infos
      // dev: !fedOptions.dev
      //   ? undefined
      //   : {
      //       entryPoint: normalize(pi.entryPoint),
      //     },
    } as SharedInfo;
  });
}

function addChunksToResult(
  chunks: BuildResult[],
  result: SharedInfo[],
  dev?: boolean,
) {
  for (const item of chunks) {
    const fileName = path.basename(item.fileName);
    result.push({
      singleton: false,
      strictVersion: false,
      // Here, the version does not matter because
      // a) a chunk split off by the bundler does
      // not have a version and b) it gets a hash
      // code as part of the file name to be unique
      // when requested via a _versioned_ package.
      //
      // For the same reason, we don't need to
      // take care of singleton and strictVersion.
      version: '0.0.0',
      requiredVersion: '0.0.0',
      packageName: deriveInternalName(fileName),
      outFileName: fileName,
      // dev: dev
      //   ? undefined
      //   : {
      //       entryPoint: normalize(fileName),
      //     },
    });
  }
}

function calcHash(hashBase: string) {
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
