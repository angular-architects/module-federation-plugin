export interface FederationOptions {
  workspaceRoot: string;
  outputPath: string;
  outputPathServer: string;
  federationConfig: string;
  tsConfig?: string;
  verbose?: boolean;
  dev?: boolean;
  watch?: boolean;
  packageJson?: string;
  isSrr: boolean;
  customLoader?: string;
}
