import { NormalizedFederationConfig } from '../config/federation-config';
import { FederationInfo } from '@softarc/native-federation-runtime';
import { FederationOptions } from './federation-options';
import { writeImportMap } from './write-import-map';
import { writeFederationInfo } from './write-federation-info';
import { bundleShared } from './bundle-shared';
import {
  bundleSharedMappings,
  describeSharedMappings,
} from './bundle-shared-mappings';
import { bundleExposed, describeExposed } from './bundle-exposed';

export interface BuildParams {
  skipMappings: boolean;
  skipExposed: boolean;
}

export const defaultBuildParams: BuildParams = {
  skipExposed: false,
  skipMappings: false,
};

export async function buildForFederation(
  config: NormalizedFederationConfig,
  fedOptions: FederationOptions,
  externals: string[],
  buildParams = defaultBuildParams
) {
  const exposedInfo = buildParams.skipExposed
    ? describeExposed(config, fedOptions)
    : await bundleExposed(config, fedOptions, externals);

  const sharedPackageInfo = await bundleShared(config, fedOptions, externals);

  const sharedMappingInfo = buildParams.skipMappings
    ? describeSharedMappings(config, fedOptions)
    : await bundleSharedMappings(config, fedOptions, externals);

  const sharedInfo = [...sharedPackageInfo, ...sharedMappingInfo];

  const federationInfo: FederationInfo = {
    name: config.name,
    shared: sharedInfo,
    exposes: exposedInfo,
  };

  writeFederationInfo(federationInfo, fedOptions);
  writeImportMap(sharedInfo, fedOptions);
}
