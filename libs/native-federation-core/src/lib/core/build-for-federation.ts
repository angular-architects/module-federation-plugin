import { NormalizedFederationConfig } from '../config/federation-config';
import { FederationInfo } from '@angular-architects/native-federation-runtime';
import { FederationOptions } from './federation-options';
import { writeImportMap } from './write-import-map';
import { writeFederationInfo } from './write-federation-info';
import { bundleShared } from './bundle-shared';
import { bundleSharedMappings } from './bundle-shared-mappings';
import { bundleExposed } from './bundle-exposed';

export async function buildForFederation(config: NormalizedFederationConfig, fedOptions: FederationOptions, externals: string[]) {
  const exposedInfo = await bundleExposed(config, fedOptions, externals);

  const sharedPackageInfo = await bundleShared(
    config,
    fedOptions,
    externals
  );

  const sharedMappingInfo = await bundleSharedMappings(
    config,
    fedOptions,
    externals
  );

  const sharedInfo = [...sharedPackageInfo, ...sharedMappingInfo];

  const federationInfo: FederationInfo = {
    name: config.name,
    shared: sharedInfo,
    exposes: exposedInfo,
  };

  writeFederationInfo(federationInfo, fedOptions);

  writeImportMap(sharedInfo, fedOptions);
}
