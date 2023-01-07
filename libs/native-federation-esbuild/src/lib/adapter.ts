import {
  BuildAdapter,
  BuildAdapterOptions,
  logger,
} from '@softarc/native-federation/build';
import * as esbuild from 'esbuild';
import { rollup } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import { externals } from 'rollup-plugin-node-externals';
import { collectExports } from './collect-exports';
import * as fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const commonjs = require('@rollup/plugin-commonjs');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const replace = require('@rollup/plugin-replace');

export const esBuildAdapter: BuildAdapter = createEsBuildAdapter({
  plugins: [],
});

export type ReplacementConfig = {
  file: string, 
  tryCompensateMissingExports: boolean
};

export interface EsBuildAdapterConfig {
  plugins: esbuild.Plugin[];
  fileReplacements?: Record<string, string | ReplacementConfig>
  skipRollup?: boolean,
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

    const r = await esbuild.build({
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

    postProcess(config, entryPoint, outfile);
  };
}

function postProcess(config: EsBuildAdapterConfig, entryPoint: string, outfile: string) {
  if (config.fileReplacements) {
    const replacements = normalize(config.fileReplacements);
    
    const normalizedPath = entryPoint.replace(/\\/g, '/');
    const key = Object.keys(replacements).find(key => normalizedPath.endsWith(key))

    if (key && replacements[key] && replacements[key].tryCompensateMissingExports) {
      const file = replacements[key].file;
      compensateExports(file, outfile);
    }
  }
}

function compensateExports(entryPoint: string, outfile: string): void {
  const inExports = collectExports(entryPoint);
  const outExports = collectExports(outfile);

  if (!outExports.hasDefaultExport || outExports.hasFurtherExports) {
    return;
  }
  const defaultName = outExports.defaultExportName;

  let exports = '/*Try to compensate missing exports*/\n\n';
  for (const exp of inExports.exports) {
    exports += `let ${exp}$softarc = ${defaultName}.${exp};\n`;
    exports += `export { ${exp}$softarc as ${exp} };\n`;
  }

  fs.appendFileSync(outfile, exports, 'utf-8');
}

async function prepareNodePackage(
  entryPoint: string,
  external: string[],
  tmpFolder: string,
  config: EsBuildAdapterConfig,
) {

  if (config.fileReplacements) {
    entryPoint = replaceEntryPoint(entryPoint, normalize(config.fileReplacements));
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

function normalize(config: Record<string, string | ReplacementConfig>): Record<string,ReplacementConfig> {
  const result: Record<string,ReplacementConfig> = {};
  for (const key in config) {
    if (typeof config[key] === 'string') {
      result[key] = {
        file: config[key] as string,
        tryCompensateMissingExports: false
      }
    }
    else {
      result[key] = config[key] as ReplacementConfig;
    }
  }
  return result;
}

function replaceEntryPoint(entryPoint: string, fileReplacements: Record<string, ReplacementConfig>): string {
  entryPoint = entryPoint.replace(/\\/g, '/');
 
  for(const key in fileReplacements) {
    entryPoint = entryPoint.replace(new RegExp(`${key}$`), fileReplacements[key].file);
  }

  return entryPoint;
}

