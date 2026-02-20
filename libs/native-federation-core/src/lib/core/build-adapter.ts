import { logger } from '../utils/logger';
import { MappedPath } from '../utils/mapped-paths';

let _buildAdapter: BuildAdapter | null = null;

// export type BuildKind =
//   | 'shared-package'
//   | 'shared-mapping'
//   | 'exposed'
//   | 'mapping-or-exposed';

export interface EntryPoint {
  fileName: string;
  outName: string;
}

export interface SetupOptions {
  entryPoints: EntryPoint[];
  tsConfigPath?: string;
  external: string[];
  outdir: string;
  mappedPaths: MappedPath[];
  bundleName: string;
  isNodeModules: boolean;
  dev?: boolean;
  hash?: boolean;
  platform?: 'browser' | 'node';
  optimizedMappings?: boolean;
  cachePath?: string;
}

export interface BuildResult {
  fileName: string;
}

export interface BuildAdapter {
  setup(options: SetupOptions): Promise<void>;

  build(
    name: string,
    opts?: {
      files?: string[];
      signal?: AbortSignal;
    },
  ): Promise<BuildResult[]>;

  dispose(name?: string): Promise<void>;
}

export function setBuildAdapter(buildAdapter: BuildAdapter): void {
  _buildAdapter = buildAdapter;
}

export function getBuildAdapter(): BuildAdapter {
  if (!_buildAdapter) {
    logger.error('Please set a BuildAdapter!');
    throw new Error('BuildAdapter not set');
  }
  return _buildAdapter;
}
