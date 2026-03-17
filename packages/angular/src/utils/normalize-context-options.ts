import type { ApplicationBuilderOptions } from '@angular/build';
import type { BuilderContext } from '@angular-devkit/architect';
import type { SourceFileCache } from '@angular/build/private';
import type {
  FederationCache,
  EntryPoint,
  NFBuildAdapterOptions,
} from '@softarc/native-federation';
import type { MappedPath } from '@softarc/native-federation/internal';

export interface NormalizedContextOptions {
  builderOptions: ApplicationBuilderOptions;
  context: BuilderContext;
  entryPoints: EntryPoint[];
  external: string[];
  outdir: string;
  tsConfigPath?: string;
  mappedPaths: MappedPath[];
  cache: FederationCache<SourceFileCache>;
  dev: boolean;
  isMappingOrExposed: boolean;
  hash: boolean;
  chunks?: boolean;
  platform?: 'browser' | 'node';
  optimizedMappings: boolean;
}

export function normalizeContextOptions(
  builderOptions: ApplicationBuilderOptions,
  context: BuilderContext,
  adapterOptions: NFBuildAdapterOptions<SourceFileCache>
): NormalizedContextOptions {
  return {
    builderOptions,
    context,
    entryPoints: adapterOptions.entryPoints,
    external: adapterOptions.external,
    outdir: adapterOptions.outdir,
    tsConfigPath: adapterOptions.tsConfigPath,
    mappedPaths: adapterOptions.mappedPaths,
    cache: adapterOptions.cache,
    dev: !!adapterOptions.dev,
    isMappingOrExposed: !!adapterOptions.isMappingOrExposed,
    hash: !!adapterOptions.hash,
    chunks: adapterOptions.chunks,
    platform: adapterOptions.platform,
    optimizedMappings: !!adapterOptions.optimizedMappings,
  };
}
