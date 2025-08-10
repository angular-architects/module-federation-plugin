import { BuildNotificationOptions } from '@softarc/native-federation-runtime';

export interface FederationOptions {
  workspaceRoot: string;
  outputPath: string;
  federationConfig: string;
  tsConfig?: string;
  verbose?: boolean;
  dev?: boolean;
  watch?: boolean;
  ssr?: boolean;
  packageJson?: string;
  entryPoint?: string;
  buildNotifications?: BuildNotificationOptions;
}
