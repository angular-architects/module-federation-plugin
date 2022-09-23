import {
  BuildAdapter,
  logger,
  MappedPath,
} from '@softarc/native-federation/build';
import * as esbuild from 'esbuild';
import { createCompilerPlugin } from '@angular-devkit/build-angular/src/builders/browser-esbuild/compiler-plugin';
import { createSharedMappingsPlugin } from './shared-mappings-plugin';
import { runRollup as runRollup } from './rollup';

import * as fs from 'fs';

import { PluginItem, transformAsync } from '@babel/core';

export const AngularEsBuildAdapter: BuildAdapter = async (options) => {
  const { entryPoint, tsConfigPath, external, outfile, mappedPaths, kind } =
    options;

  if (kind === 'shared-package') {
    await runRollup(entryPoint, external, outfile);
  } else {
    await runEsbuild(entryPoint, external, outfile, tsConfigPath, mappedPaths);
  }

  if (kind === 'shared-package' && fs.existsSync(outfile)) {
    await link(outfile);
  }
};

async function link(outfile: string) {
  const code = fs.readFileSync(outfile, 'utf-8');

  try {
    const linkerEsm = await loadEsmModule<{ default: PluginItem }>(
      '@angular/compiler-cli/linker/babel'
    );

    const linker = linkerEsm.default;

    const result = await transformAsync(code, {
      filename: outfile,
      // inputSourceMap: (useInputSourcemap ? undefined : false) as undefined,
      // sourceMaps: pluginOptions.sourcemap ? 'inline' : false,
      compact: false,
      configFile: false,
      babelrc: false,
      minified: true,
      browserslistConfigFile: false,
      plugins: [linker],
    });

    fs.writeFileSync(outfile, result.code, 'utf-8');
  } catch (e) {
    logger.error('error linking');

    if (fs.existsSync(`${outfile}.error`)) {
      fs.unlinkSync(`${outfile}.error`);
    }
    fs.renameSync(outfile, `${outfile}.error`);

    throw e;
  }
}

async function runEsbuild(
  entryPoint: string,
  external: string[],
  outfile: string,
  tsConfigPath: string,
  mappedPaths: MappedPath[],
  plugins: esbuild.Plugin[] | null = null
) {
  await esbuild.build({
    entryPoints: [entryPoint],
    external,
    outfile,
    bundle: true,
    sourcemap: true,
    minify: true,
    platform: 'browser',
    format: 'esm',
    target: ['esnext'],
    plugins: plugins || [
      createCompilerPlugin(
        {
          sourcemap: true,
          tsconfig: tsConfigPath,
          advancedOptimizations: true,
          thirdPartySourcemaps: true,
        },
        {
          optimization: true,
          sourcemap: true,
          workspaceRoot: __dirname,
        }
      ),
      ...(mappedPaths && mappedPaths.length > 0
        ? [createSharedMappingsPlugin(mappedPaths)]
        : []),
    ],
  });
}

export function loadEsmModule<T>(modulePath: string | URL): Promise<T> {
  return new Function('modulePath', `return import(modulePath);`)(
    modulePath
  ) as Promise<T>;
}
