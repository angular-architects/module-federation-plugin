export interface InitSchema {
  project: string;
  port: string | number;
  nxBuilders: boolean | undefined;
  type: 'host' | 'dynamic-host' | 'remote' | 'legacy';
  stack: 'webpack' | 'rsbuild' | 'native';
}
