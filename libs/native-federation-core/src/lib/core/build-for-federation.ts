import { NormalizedFederationConfig, NormalizedSharedConfig } from '../config/federation-config';
import { FederationInfo, SharedInfo } from '@softarc/native-federation-runtime';
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

  const { 
    sharedBrowser, 
    sharedServer, 
    separateBrowser, 
    separateServer 
  } = splitShared(config.shared);

  const sharedPackageInfoBrowser = await bundleShared(sharedBrowser, config, fedOptions, externals, 'browser');
  const sharedPackageInfoServer = await bundleShared(sharedServer, config, fedOptions, externals, 'node');
  const separatePackageInfoBrowser = await bundleSeparate(separateBrowser, externals, config, fedOptions, 'browser');
  const separatePackageInfoServer = await bundleSeparate(separateServer, externals, config, fedOptions, 'node');

  const sharedPackageInfo = [
    ...sharedPackageInfoBrowser, 
    ...sharedPackageInfoServer,
    ...separatePackageInfoBrowser,
    ...separatePackageInfoServer
  ];

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

type SplitSharedResult = {
  sharedServer: Record<string, NormalizedSharedConfig>;
  sharedBrowser: Record<string, NormalizedSharedConfig>;
  separateBrowser: Record<string, NormalizedSharedConfig>;
  separateServer: Record<string, NormalizedSharedConfig>;
};

function inferPackageFromSecondary(secondary: string): string {
  const parts = secondary.split('/');
  if (secondary.startsWith('@') && parts.length >= 2) {
      return parts[0] + '/' + parts[1];
  }
  return parts[0];
}

async function bundleSeparate(separateBrowser: Record<string, NormalizedSharedConfig>, externals: string[], config: NormalizedFederationConfig, fedOptions: FederationOptions, platform: 'node' | 'browser') {
  const result: SharedInfo[] = [];
  for (const key in separateBrowser) {
    const shared = separateBrowser[key];
    const packageName = inferPackageFromSecondary(key);
    const filteredExternals = externals.filter(e => !e.startsWith(packageName));
    const record = { [key]: shared };
    const buildResult = await bundleShared(record, config, fedOptions, filteredExternals, platform);
    buildResult.forEach(item => result.push(item));
  }
  return result;
}

function splitShared(shared: Record<string, NormalizedSharedConfig>): SplitSharedResult {
  const sharedServer: Record<string, NormalizedSharedConfig> = {};
  const sharedBrowser: Record<string, NormalizedSharedConfig> = {};
  const separateBrowser: Record<string, NormalizedSharedConfig> = {};
  const separateServer: Record<string, NormalizedSharedConfig> = {};

  for (const key in shared) {
    const obj = shared[key];
    if (obj.platform === 'node' && obj.build === 'default') {
      sharedServer[key] = obj;
    }
    else if (obj.platform === 'node' && obj.build === 'separate') {
      separateServer[key] = obj;
    }
    else if (obj.platform === 'browser' && obj.build === 'default') {
      sharedBrowser[key] = obj;
    }
    else {
      separateBrowser[key] = obj;
    }
  }

  return {
    sharedBrowser, 
    sharedServer,
    separateBrowser,
    separateServer,
  };

}

