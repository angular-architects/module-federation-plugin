export interface MfSchematicSchema {
  project: string;
  port: string;
  nxBuilders: boolean | undefined;
  skipConfirmation: boolean;
  type: 'host' | 'dynamic-host' | 'remote' | 'legacy';
}
