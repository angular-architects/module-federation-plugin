import { FederationInfo, SharedInfo } from '@softarc/native-federation-runtime';
import {
  NormalizedFederationConfig,
  NormalizedSharedConfig,
} from '../config/federation-config';
import {
  ArtefactInfo,
  bundleExposedAndMappings,
  describeExposed,
  describeSharedMappings,
} from './bundle-exposed-and-mappings';
import { bundleShared } from './bundle-shared';
import { FederationOptions } from './federation-options';
import { writeFederationInfo } from './write-federation-info';
import { writeImportMap } from './write-import-map';
import { logger } from '../utils/logger';

export interface BuildParams {
  skipMappingsAndExposed: boolean;
  skipShared: boolean;
}

export const defaultBuildParams: BuildParams = {
  skipMappingsAndExposed: false,
  skipShared: false,
};

let sharedPackageInfoCache: SharedInfo[] = [];

export async function buildForFederation(
  config: NormalizedFederationConfig,
  fedOptions: FederationOptions,
  externals: string[],
  buildParams = defaultBuildParams
): Promise<FederationInfo> {
  let artefactInfo: ArtefactInfo | undefined;

  if (!buildParams.skipMappingsAndExposed) {
    let start = process.hrtime();
    artefactInfo = await bundleExposedAndMappings(
      config,
      fedOptions,
      externals
    );
    logger.measure(
      start,
      '[build artifacts] - To bundle all mappings and exposed.'
    );
  }

  const exposedInfo = !artefactInfo
    ? describeExposed(config, fedOptions)
    : artefactInfo.exposes;

  if (!buildParams.skipShared) {
    const { sharedBrowser, sharedServer, separateBrowser, separateServer } =
      splitShared(config.shared);

    let start = process.hrtime();
    const sharedPackageInfoBrowser = await bundleShared(
      sharedBrowser,
      config,
      fedOptions,
      externals,
      'browser'
    );
    logger.measure(
      start,
      '[build artifacts] - To bundle all shared browser externals'
    );

    start = process.hrtime();
    const sharedPackageInfoServer = await bundleShared(
      sharedServer,
      config,
      fedOptions,
      externals,
      'node'
    );
    logger.measure(
      start,
      '[build artifacts] - To bundle all shared node externals'
    );

    start = process.hrtime();
    const separatePackageInfoBrowser = await bundleSeparate(
      separateBrowser,
      externals,
      config,
      fedOptions,
      'browser'
    );
    logger.measure(
      start,
      '[build artifacts] - To bundle all separate browser externals'
    );

    start = process.hrtime();
    const separatePackageInfoServer = await bundleSeparate(
      separateServer,
      externals,
      config,
      fedOptions,
      'node'
    );
    logger.measure(
      start,
      '[build artifacts] - To bundle all separate node externals'
    );

    sharedPackageInfoCache = [
      ...sharedPackageInfoBrowser,
      ...sharedPackageInfoServer,
      ...separatePackageInfoBrowser,
      ...separatePackageInfoServer,
    ];
  }

  const sharedMappingInfo = !artefactInfo
    ? describeSharedMappings(config, fedOptions)
    : artefactInfo.mappings;

  const sharedInfo = [...sharedPackageInfoCache, ...sharedMappingInfo];
  const buildNotificationsEndpoint =
    fedOptions.buildNotifications?.enable && fedOptions.dev
      ? fedOptions.buildNotifications?.endpoint
      : undefined;
  const federationInfo: FederationInfo = {
    name: config.name,
    shared: sharedInfo,
    exposes: exposedInfo,
    buildNotificationsEndpoint,
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

async function bundleSeparate(
  separateBrowser: Record<string, NormalizedSharedConfig>,
  externals: string[],
  config: NormalizedFederationConfig,
  fedOptions: FederationOptions,
  platform: 'node' | 'browser'
) {
  const bundlePromises = Object.entries(separateBrowser).map(
    async ([key, shared]) => {
      const packageName = inferPackageFromSecondary(key);
      const filteredExternals = externals.filter(
        (e) => !e.startsWith(packageName)
      );
      return bundleShared(
        { [key]: shared },
        config,
        fedOptions,
        filteredExternals,
        platform
      );
    }
  );

  const buildResults = await Promise.all(bundlePromises);
  return buildResults.flat();
}

function splitShared(
  shared: Record<string, NormalizedSharedConfig>
): SplitSharedResult {
  const sharedServer: Record<string, NormalizedSharedConfig> = {};
  const sharedBrowser: Record<string, NormalizedSharedConfig> = {};
  const separateBrowser: Record<string, NormalizedSharedConfig> = {};
  const separateServer: Record<string, NormalizedSharedConfig> = {};

  for (const key in shared) {
    const obj = shared[key];
    if (obj.platform === 'node' && obj.build === 'default') {
      sharedServer[key] = obj;
    } else if (obj.platform === 'node' && obj.build === 'separate') {
      separateServer[key] = obj;
    } else if (obj.platform === 'browser' && obj.build === 'default') {
      sharedBrowser[key] = obj;
    } else {
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
