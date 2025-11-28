import { FederationInfo } from '@softarc/native-federation-runtime';
import {
  getConfigContext,
  usePackageJson,
  useWorkspace,
} from '../config/configuration-context';
import { NormalizedFederationConfig } from '../config/federation-config';
import { BuildAdapter, setBuildAdapter } from './build-adapter';
import { buildForFederation, defaultBuildParams } from './build-for-federation';
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
let fedInfo: FederationInfo;

async function init(params: BuildHelperParams): Promise<void> {
  setBuildAdapter(params.adapter);
  fedOptions = params.options;
  useWorkspace(params.options.workspaceRoot);
  usePackageJson(params.options.packageJson);
  config = await loadFederationConfig(fedOptions);
  params.options.workspaceRoot =
    getConfigContext().workspaceRoot ?? params.options.workspaceRoot;
  externals = getExternals(config);
}

async function build(buildParams = defaultBuildParams): Promise<void> {
  fedInfo = await buildForFederation(
    config,
    fedOptions,
    externals,
    buildParams,
  );
}

export const federationBuilder = {
  init,
  build,
  get federationInfo() {
    return fedInfo;
  },
  get externals(): string[] {
    return externals;
  },
  get config(): NormalizedFederationConfig {
    return config;
  },
};
