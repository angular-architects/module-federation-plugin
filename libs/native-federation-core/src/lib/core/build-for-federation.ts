import { NormalizedFederationConfig, NormalizedSharedConfig } from '../config/federation-config';
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

export interface BuildParams {
  skipMappingsAndExposed: boolean;
}

export const defaultBuildParams: BuildParams = {
  skipMappingsAndExposed: false,
};


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

  const { sharedBrowser, sharedServer } = splitShared(config.shared);

  const sharedPackageInfoBrowser = await bundleShared(sharedBrowser, config, fedOptions, externals, 'browser');
  const sharedPackageInfoServer = await bundleShared(sharedServer, config, fedOptions, externals, 'node');

  const sharedPackageInfo = [...sharedPackageInfoBrowser, ...sharedPackageInfoServer];

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

function splitShared(shared: Record<string, NormalizedSharedConfig>): {sharedServer: Record<string, NormalizedSharedConfig>, sharedBrowser: Record<string, NormalizedSharedConfig>} {
  const sharedServer: Record<string, NormalizedSharedConfig> = {};
  const sharedBrowser: Record<string, NormalizedSharedConfig> = {};

  for (const key in shared) {
    if (shared[key].platform === 'node') {
      sharedServer[key] = shared[key];
    }
    else {
      sharedBrowser[key] = shared[key];
    }
  }

  return {
    sharedBrowser, 
    sharedServer
  };

}

