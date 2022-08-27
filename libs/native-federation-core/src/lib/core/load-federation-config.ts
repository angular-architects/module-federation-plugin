import { NormalizedFederationConfig } from '../config/federation-config';
import { FederationOptions } from './federation-options';
import * as path from 'path';
import * as fs from 'fs';

export async function loadFederationConfig(fedOptions: FederationOptions): Promise<NormalizedFederationConfig> {
  
  const fullConfigPath = path.join(fedOptions.workspaceRoot, fedOptions.federationConfig);

  if (!fs.existsSync(fullConfigPath)) {
    throw new Error('Expected ' + fullConfigPath);
  }

  const config = (await import(fullConfigPath)) as NormalizedFederationConfig;
  return config;
}
