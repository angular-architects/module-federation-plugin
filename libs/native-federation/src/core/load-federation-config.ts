import { NormalizedFederationConfig } from '../config/federation-config';

export async function loadFederationConfig(fullConfigPath: string): Promise<NormalizedFederationConfig> {
  const config = (await import(fullConfigPath)) as NormalizedFederationConfig;
  return config;
}
