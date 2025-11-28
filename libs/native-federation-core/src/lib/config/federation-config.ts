import { PreparedSkipList, SkipList } from '../core/default-skip-list';
import { MappedPath } from '../utils/mapped-paths';

export interface SharedConfig {
  singleton?: boolean;
  strictVersion?: boolean;
  requiredVersion?: string;
  version?: string;
  includeSecondaries?: boolean;
  transient?: boolean;
  platform?: 'browser' | 'node';
  build?: 'default' | 'separate';
  packageInfo?: {
    entryPoint: string;
    version: string;
    esm: boolean;
  };
}

export interface FederationConfig {
  name?: string;
  exposes?: Record<string, string>;
  shared?: Record<string, SharedConfig>;
  sharedMappings?: Array<string>;
  skip?: SkipList;
  externals?: string[];
  features?: {
    mappingVersion?: boolean;
    ignoreUnusedDeps?: boolean;
  };
}

export interface NormalizedSharedConfig {
  singleton: boolean;
  strictVersion: boolean;
  requiredVersion: string;
  version?: string;
  includeSecondaries?: boolean;
  platform: 'browser' | 'node';
  build: 'default' | 'separate';
  packageInfo?: {
    entryPoint: string;
    version: string;
    esm: boolean;
  };
}

export interface NormalizedFederationConfig {
  name: string;
  exposes: Record<string, string>;
  shared: Record<string, NormalizedSharedConfig>;
  sharedMappings: Array<MappedPath>;
  skip: PreparedSkipList;
  externals: string[];
  features: {
    mappingVersion: boolean;
    ignoreUnusedDeps: boolean;
  };
}
