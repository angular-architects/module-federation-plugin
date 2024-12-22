import { logger } from '../utils/logger';
import { MappedPath } from '../utils/mapped-paths';

let _buildAdapter: BuildAdapter = async () => {
  // TODO: add logger
  logger.error('Please set a BuildAdapter!');
  return [];
};

export type BuildKind =
  | 'shared-package'
  | 'shared-mapping'
  | 'exposed'
  | 'mapping-or-exposed';

export interface EntryPoint {
  fileName: string;
  outName: string;
}

export interface BuildAdapterOptions {
  entryPoints: EntryPoint[];
  tsConfigPath?: string;
  external: Array<string>;
  outdir: string;
  mappedPaths: MappedPath[];
  packageName?: string;
  esm?: boolean;
  dev?: boolean;
  watch?: boolean;
  kind: BuildKind;
  hash: boolean;
  platform?: 'browser' | 'node';
}

export interface BuildResult {
  fileName: string;
}

export type BuildAdapter = (
  options: BuildAdapterOptions
) => Promise<BuildResult[]>;

export function setBuildAdapter(buildAdapter: BuildAdapter): void {
  _buildAdapter = buildAdapter;
}

export function getBuildAdapter(): BuildAdapter {
  return _buildAdapter;
}
