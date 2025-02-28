export interface InitSchema {
  project: string;
  port: string | number;
  nxBuilders: boolean | undefined;
  type: 'host' | 'dynamic-host' | 'remote' | 'legacy';
  skipConfirmation: boolean;
  stack:
    | 'module-federation-webpack'
    | 'module-federation-rsbuild-experimental'
    | 'native-federation-esbuild';
}
