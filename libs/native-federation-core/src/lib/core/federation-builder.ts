import { SharedInfo } from '@softarc/native-federation';
import { NormalizedFederationConfig } from '../config/federation-config';
import { BuildAdapter, setBuildAdapter } from './build-adapter';
import { buildForFederation } from './build-for-federation';
import { bundleShared } from './bundle-shared';
import { FederationOptions } from './federation-options';
import { getExternals } from './get-externals';
import { loadFederationConfig } from './load-federation-config';

export interface BuildHelperParams {
  options: FederationOptions;
  adapter: BuildAdapter;
}

let externals: string[] = [];
let config: NormalizedFederationConfig;
let fedOptions: FederationOptions;

async function init(params: BuildHelperParams): Promise<void> {
  setBuildAdapter(params.adapter);
  fedOptions = params.options;
  config = await loadFederationConfig(fedOptions);
  externals = getExternals(config);
}

async function build(): Promise<void> {
  buildForFederation(config, fedOptions, externals);
}

async function buildShared(): Promise<SharedInfo[]> {
  return bundleShared(config, fedOptions, externals);
}

export const federationBuilder = {
  init,
  build,
  buildShared,
  get externals(): string[] {
    return externals;
  },
  get config(): NormalizedFederationConfig {
    return config;
  }
};
