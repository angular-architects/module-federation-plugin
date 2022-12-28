export interface FederationOptions {
  workspaceRoot: string;
  /**
   * Defaults to workspaceRoot
   */
  projectRoot?: string;
  outputPath: string;
  federationConfig: string;
  tsConfig?: string;
  verbose?: boolean;
  dev?: boolean;
  watch?: boolean;
}
