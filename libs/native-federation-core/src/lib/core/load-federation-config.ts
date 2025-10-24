import { NormalizedFederationConfig } from '../config/federation-config';
import { FederationOptions } from './federation-options';
import * as path from 'path';
import * as fs from 'fs';
import { removeUnusedDeps } from './remove-unused-deps';

export async function loadFederationConfig(
  fedOptions: FederationOptions
): Promise<NormalizedFederationConfig> {
  const fullConfigPath = path.join(
    fedOptions.workspaceRoot,
    fedOptions.federationConfig
  );

  if (!fs.existsSync(fullConfigPath)) {
    throw new Error('Expected ' + fullConfigPath);
  }

  const config = (await import(fullConfigPath)) as NormalizedFederationConfig;

  if (config.features.ignoreUnusedDeps && !fedOptions.entryPoint) {
    throw new Error(
      `The feature ignoreUnusedDeps needs the application's entry point. Please set it in your federation options!`
    );
  }

  if (config.features.ignoreUnusedDeps) {
    // const entryPoint = path.join(fedOptions.workspaceRoot, fedOptions.entryPoint ?? '');

    return removeUnusedDeps(
      config,
      fedOptions.entryPoint ?? '',
      fedOptions.workspaceRoot
    );
  }

  return config;
}
