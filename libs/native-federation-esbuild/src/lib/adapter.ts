import {
  BuildAdapter,
  BuildAdapterOptions,
  logger,
} from '@softarc/native-federation/build';
import * as esbuild from 'esbuild';
import { rollup } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import { externals } from 'rollup-plugin-node-externals';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const commonjs = require('@rollup/plugin-commonjs');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const replace = require('@rollup/plugin-replace');

export const esBuildAdapter: BuildAdapter = createEsBuildAdapter({
  plugins: [],
});

export interface EsBuildAdapterConfig {
  plugins: esbuild.Plugin[];
  fileReplacements?: Record<string, string>
}

export function createEsBuildAdapter(config: EsBuildAdapterConfig) {
  return async (options: BuildAdapterOptions) => {
    const { entryPoint, external, outfile, watch } = options;

    const isPkg = entryPoint.includes('node_modules');
    const pkgName = isPkg ? inferePkgName(entryPoint) : '';
    const tmpFolder = `node_modules/.tmp/${pkgName}`;

    if (isPkg) {
      await prepareNodePackage(entryPoint, external, tmpFolder, config);
    }

    await esbuild.build({
      entryPoints: [isPkg ? tmpFolder : entryPoint],
      external,
      outfile,
      bundle: true,
      sourcemap: true,
      minify: true,
      watch: !watch
        ? false
        : {
            onRebuild: (err) => {
              if (err) {
                logger.error('Error rebuilding ' + entryPoint);
              } else {
                logger.info('Rebuilt ' + entryPoint);
              }
            },
          },
      format: 'esm',
      target: ['esnext'],
      plugins: [...config.plugins],
    });
  };
}

async function prepareNodePackage(
  entryPoint: string,
  external: string[],
  tmpFolder: string,
  config: EsBuildAdapterConfig,
) {


  if (config.fileReplacements) {
    entryPoint = replaceEntryPoint(entryPoint, config.fileReplacements);
  }

  const result = await rollup({
    input: entryPoint,

    plugins: [
      commonjs(),
      externals({ include: external }),
      resolve(),
      replace({
        preventAssignment: true,
        values: {
          'process.env.NODE_ENV': '"development"',
        },
      }),
    ],
  });

  await result.write({
    format: 'esm',
    file: tmpFolder,
    sourcemap: true,
    exports: 'named',
  });
}

function inferePkgName(entryPoint: string) {
  return entryPoint
    .replace(/.*?node_modules/g, '')
    .replace(/[^A-Za-z0-9.]/g, '_');
}

function replaceEntryPoint(entryPoint: string, fileReplacements: Record<string, string>): string {
  entryPoint = entryPoint.replace(/\\/g, '/');
 
  for(const key in fileReplacements) {
    entryPoint = entryPoint.replace(new RegExp(`${key}$`), fileReplacements[key]);
  }

  return entryPoint;
}

