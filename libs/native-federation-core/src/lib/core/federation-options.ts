import { BuildNotificationOptions } from '@softarc/native-federation-runtime';

export interface FederationOptions {
  workspaceRoot: string;
  outputPath: string;
  federationConfig: string;
  cacheExternalArtifacts?: boolean;
  tsConfig?: string;
  verbose?: boolean;
  dev?: boolean;
  watch?: boolean;
  packageJson?: string;
  entryPoint?: string;
  buildNotifications?: BuildNotificationOptions;
}
