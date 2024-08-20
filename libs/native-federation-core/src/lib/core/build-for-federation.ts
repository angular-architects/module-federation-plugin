import { NormalizedFederationConfig } from '../config/federation-config';
import { FederationInfo } from '@softarc/native-federation-runtime';
import { FederationOptions } from './federation-options';
import { writeImportMap } from './write-import-map';
import { writeFederationInfo } from './write-federation-info';
import { bundleShared } from './bundle-shared';
import {
  ArtefactInfo,
  bundleExposedAndMappings,
  describeExposed,
  describeSharedMappings,
} from './bundle-exposed-and-mappings';
import { bundle } from '../utils/build-utils';
import * as promisesFs from 'fs/promises';
import * as path from 'path';
export interface BuildParams {
  skipMappingsAndExposed: boolean;
}

export const defaultBuildParams: BuildParams = {
  skipMappingsAndExposed: false,
};

export async function buildForCustomLoader(
  config: NormalizedFederationConfig,
  fedOptions: FederationOptions,
  buildParams = defaultBuildParams
) {
  if (!fedOptions.customLoader) throw new Error('No custom loader provided');

  const nameCustomLoader = path.parse(fedOptions.customLoader).name;

  await bundle({
    entryPoints: [
      {
        fileName: path.join(fedOptions.workspaceRoot, fedOptions.customLoader),
        outName: nameCustomLoader,
      },
    ],
    tsConfigPath: fedOptions.tsConfig,
    external: ['fs', 'path', 'url'],
    outdir: path.join(fedOptions.workspaceRoot, fedOptions.outputPathServer),
    mappedPaths: config.sharedMappings,
    dev: fedOptions.dev,
    kind: 'shared-package',
    hash: false,
    esm: true,
  });
  await new Promise((resolve) => {
    setTimeout(() => resolve(void 0), 2000);
  });
  await promisesFs.rename(
    path.join(
      fedOptions.workspaceRoot,
      fedOptions.outputPathServer,
      nameCustomLoader
    ) + '.js',
    path.join(
      fedOptions.workspaceRoot,
      fedOptions.outputPathServer,
      nameCustomLoader
    ) + '.mjs'
  );
}

export async function buildForFederation(
  config: NormalizedFederationConfig,
  fedOptions: FederationOptions,
  externals: string[],
  buildParams = defaultBuildParams
) {
  let artefactInfo: ArtefactInfo | undefined;
  if (!buildParams.skipMappingsAndExposed) {
    artefactInfo = await bundleExposedAndMappings(
      config,
      fedOptions,
      externals
    );
  }

  const exposedInfo = !artefactInfo
    ? describeExposed(config, fedOptions)
    : artefactInfo.exposes;

  const sharedPackageInfo = await bundleShared(config, fedOptions, externals);

  const sharedMappingInfo = !artefactInfo
    ? describeSharedMappings(config, fedOptions)
    : artefactInfo.mappings;

  const sharedInfo = [...sharedPackageInfo, ...sharedMappingInfo];

  const federationInfo: FederationInfo = {
    name: config.name,
    shared: sharedInfo,
    exposes: exposedInfo,
  };

  writeFederationInfo(federationInfo, fedOptions);
  writeImportMap(sharedInfo, fedOptions);

  return federationInfo;
}
