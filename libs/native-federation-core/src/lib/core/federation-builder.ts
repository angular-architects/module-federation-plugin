import { NormalizedFederationConfig } from '../config/federation-config';
import { BuildAdapter, setBuildAdapter } from './build-adapter';
import { buildForFederation } from './build-for-federation';
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

export const federationBuilder = {
  init,
  build,
  get externals(): string[] {
    return externals;
  },
};
