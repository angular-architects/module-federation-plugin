export type SharedInfo = {
  singleton: boolean;
  strictVersion: boolean;
  requiredVersion: string;
  version?: string;
  packageName: string;
  outFileName: string;
  dev?: {
    entryPoint: string;
  };
};

export interface ExposesInfo {
  key: string;
  outFileName: string;
  dev?: {
    entryPoint: string;
  };
}

export interface FederationInfo {
  name: string;
  exposes: ExposesInfo[];
  shared: SharedInfo[];
}
