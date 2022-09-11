import { MappedPath } from '../utils/mapped-paths';

let _buildAdapter: BuildAdapter = async () => {
  // TODO: add logger
  console.error('Please set a BuildAdapter!');
};

export interface BuildAdapterOptions {
  entryPoint: string;
  tsConfigPath?: string;
  external: Array<string>;
  outfile: string;
  mappedPaths: MappedPath[];
  packageName?: string;
  esm?: boolean;
  kind: 'shared-package' | 'shared-mapping' | 'exposed';
}

export type BuildAdapter = (options: BuildAdapterOptions) => Promise<void>;

export function setBuildAdapter(buildAdapter: BuildAdapter): void {
  _buildAdapter = buildAdapter;
}

export function getBuildAdapter(): BuildAdapter {
  return _buildAdapter;
}
