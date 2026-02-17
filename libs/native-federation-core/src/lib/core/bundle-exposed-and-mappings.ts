import fs from 'fs';
import path from 'path';

import { ExposesInfo, SharedInfo } from '@softarc/native-federation-runtime';
import { NormalizedFederationConfig } from '../config/federation-config';
import {
  createBuildResultMap,
  lookupInResultMap,
} from '../utils/build-result-map';
import { bundle } from '../utils/build-utils';
import { logger } from '../utils/logger';
import { normalize } from '../utils/normalize';
import { FederationOptions } from './federation-options';
import { AbortedError } from '../utils/errors';

export interface ArtefactInfo {
  mappings: SharedInfo[];
  exposes: ExposesInfo[];
}

export async function bundleExposedAndMappings(
  config: NormalizedFederationConfig,
  fedOptions: FederationOptions,
  externals: string[],
  cachePath: string,
  signal?: AbortSignal,
): Promise<ArtefactInfo> {
  if (signal?.aborted) {
    throw new AbortedError(
      '[bundle-exposed-and-mappings] Aborted before bundling',
    );
  }

  const shared = config.sharedMappings.map((sm) => {
    const entryPoint = sm.path;
    const tmp = sm.key.replace(/[^A-Za-z0-9]/g, '_');
    const outFilePath = tmp + '.js';
    return { fileName: entryPoint, outName: outFilePath, key: sm.key };
  });
  const exposes = Object.keys(config.exposes).map((key) => {
    const entryPoint = config.exposes[key];
    const outFilePath = key + '.js';
    return { fileName: entryPoint, outName: outFilePath, key };
  });

  const entryPoints = [...shared, ...exposes];

  const hash = !fedOptions.dev;

  logger.info('Building federation artefacts');

  let result;
  try {
    result = await bundle({
      entryPoints,
      outdir: fedOptions.outputPath,
      tsConfigPath: fedOptions.tsConfig,
      external: externals,
      dev: !!fedOptions.dev,
      watch: fedOptions.watch,
      mappedPaths: config.sharedMappings,
      kind: 'mapping-or-exposed',
      hash,
      optimizedMappings: config.features.ignoreUnusedDeps,
      cachePath,
      signal,
    });
    if (signal?.aborted) {
      throw new AbortedError(
        '[bundle-exposed-and-mappings] Aborted after bundle',
      );
    }
  } catch (error) {
    if (!(error instanceof AbortedError)) {
      logger.error('Error building federation artefacts');
    }
    throw error;
  }

  const resultMap = createBuildResultMap(result, hash);

  const sharedResult: Array<SharedInfo> = [];

  for (const item of shared) {
    sharedResult.push({
      packageName: item.key,
      outFileName: lookupInResultMap(resultMap, item.outName),
      requiredVersion: '',
      singleton: true,
      strictVersion: false,
      version: config.features.mappingVersion
        ? getMappingVersion(item.fileName)
        : '',
      dev: !fedOptions.dev
        ? undefined
        : {
            entryPoint: normalize(path.normalize(item.fileName)),
          },
    });
  }

  const exposedResult: Array<ExposesInfo> = [];

  for (const item of exposes) {
    exposedResult.push({
      key: item.key,
      outFileName: lookupInResultMap(resultMap, item.outName),
      dev: !fedOptions.dev
        ? undefined
        : {
            entryPoint: normalize(
              path.join(fedOptions.workspaceRoot, item.fileName),
            ),
          },
    });
  }

  return { mappings: sharedResult, exposes: exposedResult };
}

export function describeExposed(
  config: NormalizedFederationConfig,
  options: FederationOptions,
): Array<ExposesInfo> {
  const result: Array<ExposesInfo> = [];

  for (const key in config.exposes) {
    const localPath = normalize(
      path.normalize(path.join(options.workspaceRoot, config.exposes[key])),
    );

    result.push({
      key,
      outFileName: '',
      dev: !options.dev
        ? undefined
        : {
            entryPoint: localPath,
          },
    });
  }

  return result;
}

export function describeSharedMappings(
  config: NormalizedFederationConfig,
  fedOptions: FederationOptions,
): Array<SharedInfo> {
  const result: Array<SharedInfo> = [];

  for (const m of config.sharedMappings) {
    result.push({
      packageName: m.key,
      outFileName: '',
      requiredVersion: '',
      singleton: true,
      strictVersion: false,
      version: config.features.mappingVersion ? getMappingVersion(m.path) : '',
      dev: !fedOptions.dev
        ? undefined
        : {
            entryPoint: normalize(path.normalize(m.path)),
          },
    });
  }

  return result;
}

function getMappingVersion(fileName: string): string {
  const entryFileDir = path.dirname(fileName);
  const cand1 = path.join(entryFileDir, 'package.json');
  const cand2 = path.join(path.dirname(entryFileDir), 'package.json');

  const packageJsonPath = [cand1, cand2].find((cand) => fs.existsSync(cand));
  if (packageJsonPath) {
    const json = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return json.version ?? '';
  }
  return '';
}
