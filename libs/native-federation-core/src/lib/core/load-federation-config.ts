import { NormalizedFederationConfig } from '../config/federation-config';
import { FederationOptions } from './federation-options';
import * as path from 'path';
import * as fs from 'fs';

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

  const fnOrConfig = (await import('file://' + fullConfigPath) as any).default;
  return Promise.resolve(
    typeof fnOrConfig === 'function' ?
      fnOrConfig() :
      fnOrConfig);
};

