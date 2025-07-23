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
import { copySrcMapIfExists } from '../utils/copy-src-map-if-exists';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { DEFAULT_EXTERNAL_LIST } from './default-external-list';
import { BuildResult } from './build-adapter';
import {
  deriveInternalName,
  isSourceFile,
  rewriteChunkImports,
} from '../utils/rewrite-chunk-imports';

export async function bundleShared(
  sharedBundles: Record<string, NormalizedSharedConfig>,
  config: NormalizedFederationConfig,
  fedOptions: FederationOptions,
  externals: string[],
  platform: 'browser' | 'node' = 'browser'
): Promise<Array<SharedInfo>> {
  const folder = fedOptions.packageJson
    ? path.dirname(fedOptions.packageJson)
    : fedOptions.workspaceRoot;

  const cachePath = path.join(
    fedOptions.workspaceRoot,
    'node_modules/.cache/native-federation'
  );

  fs.mkdirSync(cachePath, { recursive: true });

  const inferedPackageInfos = Object.keys(sharedBundles)
    .filter((packageName) => !sharedBundles[packageName].packageInfo)
    .map((packageName) => getPackageInfo(packageName, folder))
    .filter((pi) => !!pi) as PackageInfo[];

  const configuredPackageInfos = Object.keys(sharedBundles)
    .filter((packageName) => !!sharedBundles[packageName].packageInfo)
    .map((packageName) => ({
      packageName,
      ...sharedBundles[packageName].packageInfo,
    })) as PackageInfo[];

  const packageInfos = [...inferedPackageInfos, ...configuredPackageInfos];

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
    fedOptions.outputPath
  );

  const exptedResults = allEntryPoints.map((ep) =>
    path.join(fullOutputPath, ep.outName)
  );
  const entryPoints = allEntryPoints.filter(
    (ep) => !fs.existsSync(path.join(cachePath, ep.outName))
  );

  if (entryPoints.length > 0) {
    logger.info('Preparing shared npm packages for the platform ' + platform);
    logger.notice('This only needs to be done once, as results are cached');
    logger.notice(
      "Skip packages you don't want to share in your federation config"
    );
  }

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
      outdir: cachePath,
      mappedPaths: config.sharedMappings,
      dev: fedOptions.dev,
      kind: 'shared-package',
      hash: false,
      platform,
      optimizedMappings: config.features.ignoreUnusedDeps,
    });

    const cachedFiles = bundleResult.map((br) => path.basename(br.fileName));
    rewriteImports(cachedFiles, cachePath);

    copyCacheToOutput(cachedFiles, cachePath, fullOutputPath);
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
    throw e;
  }

  const resultCacheFile = createCacheFileName(
    configState,
    sharedBundles,
    fedOptions,
    cachePath,
    platform
  );

  if (fs.existsSync(resultCacheFile)) {
    const cachedResult: SharedInfo[] = JSON.parse(
      fs.readFileSync(resultCacheFile, 'utf-8')
    );
    const cachedFiles = cachedResult.map((cr) => cr.outFileName);

    // Chunks are overwritten by the bundler, so we need to reprocess them
    rewriteImports(cachedFiles, cachePath);

    copyCacheToOutput(cachedFiles, cachePath, fullOutputPath);
    return cachedResult;
  }

  const outFileNames = [...exptedResults];

  const result = buildResult(
    packageInfos,
    sharedBundles,
    outFileNames,
    fedOptions
  );

  // TODO: Decide whether/when to add .map files
  const chunks = bundleResult.filter(
    (br) =>
      !br.fileName.endsWith('.map') &&
      !result.find((r) => r.outFileName === path.basename(br.fileName))
  );

  addChunksToResult(chunks, result, fedOptions.dev);

  fs.writeFileSync(
    resultCacheFile,
    JSON.stringify(result, undefined, 2),
    'utf-8'
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

function copyCacheToOutput(
  cachedFiles: string[],
  cachePath: string,
  fullOutputPath: string
) {
  for (const fileName of cachedFiles) {
    const cachedFile = path.join(cachePath, fileName);
    const distFileName = path.join(fullOutputPath, fileName);
    copyFileIfExists(cachedFile, distFileName);
    copySrcMapIfExists(cachedFile, distFileName);
  }
}

function createOutName(
  pi: PackageInfo,
  configState: string,
  fedOptions: FederationOptions,
  encName: string
) {
  const hashBase = pi.version + '_' + pi.entryPoint + '_' + configState;
  const hash = calcHash(hashBase);

  const outName = fedOptions.dev
    ? `${encName}.${hash}-dev.js`
    : `${encName}.${hash}.js`;
  return outName;
}

function createCacheFileName(
  configState: string,
  sharedBundles: Record<string, NormalizedSharedConfig>,
  fedOptions: FederationOptions,
  cachePath: string,
  platform: string
) {
  const resultCacheState = configState + JSON.stringify(sharedBundles);
  const resultHash = calcHash(resultCacheState);
  const dev = fedOptions.dev ? '-dev' : '';
  const resultCacheFile = path.join(
    cachePath,
    'result-' + resultHash + '-' + platform + dev + '.json'
  );
  return resultCacheFile;
}

function buildResult(
  packageInfos: PackageInfo[],
  sharedBundles: Record<string, NormalizedSharedConfig>,
  outFileNames: string[],
  fedOptions: FederationOptions
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
      shareScope: shared.shareScope,
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
  dev?: boolean
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
      requiredVersion: '0.0.0',
      version: '0.0.0',
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

function copyFileIfExists(cachedFile: string, fullOutputPath: string) {
  fs.mkdirSync(path.dirname(fullOutputPath), { recursive: true });

  if (fs.existsSync(cachedFile)) {
    fs.copyFileSync(cachedFile, fullOutputPath);
  }
}
