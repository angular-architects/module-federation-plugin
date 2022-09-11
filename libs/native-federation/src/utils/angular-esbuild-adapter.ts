import { BuildAdapter, MappedPath } from '@softarc/native-federation/build';
import * as esbuild from 'esbuild';
import { createCompilerPlugin } from '@angular-devkit/build-angular/src/builders/browser-esbuild/compiler-plugin';
import { createSharedMappingsPlugin } from './shared-mappings-plugin';
import { prepareNodePackage as runRollup } from './prepare-node-package';

import * as fs from 'fs';
import * as path from 'path';

import { PluginItem, transformAsync } from '@babel/core';

// const SKIP_PACKAGE_PREPARATION = ['@angular', '@ngrx', 'rxjs', 'zone.js'];

export const AngularEsBuildAdapter: BuildAdapter = async (options) => {
  const {
    entryPoint,
    tsConfigPath,
    external,
    outfile,
    mappedPaths,
    packageName,
    esm,
    kind,
  } = options;

  // const pNameOrEmpty = packageName ?? '';

  // const preparePackage = entryPoint.includes("node_modules")
  //   &&  !(SKIP_PACKAGE_PREPARATION.find(p => pNameOrEmpty?.split('/')[0] === p)
  //   || esm);

  // const pkgName = preparePackage ? inferePkgName(entryPoint) : "";
  // const tmpFolder = `node_modules/.tmp/native-federation/${pkgName}`;

  if (kind === 'shared-package') {
    await runRollup(entryPoint, external, outfile);
  } else {
    await runEsbuild(
      entryPoint,
      external,
      outfile,
      tsConfigPath,
      mappedPaths,
      // kind === 'shared-package' ? [] : null,
      // kind === 'shared-package' ? path.dirname(entryPoint) : undefined,
    );
  }

  if (kind === 'shared-package' && fs.existsSync(outfile)) {
    await link(outfile);
  }
};

async function link(outfile: string) {
  console.log('linking shared package');
  const code = fs.readFileSync(outfile, 'utf-8');

  try {
    const linkerEsm = await loadEsmModule<{ default: PluginItem; }>(
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
      browserslistConfigFile: false,
      plugins: [linker],
    });

    fs.writeFileSync(outfile, result.code, 'utf-8');
  } catch (e) {
    console.error('error linking', e);

    if (fs.existsSync(`${outfile}.error`)) {
      fs.unlinkSync(`${outfile}.error`);
    }
    fs.renameSync(outfile, `${outfile}.error`);
  }
}

async function runEsbuild(
  entryPoint: string,
  external: string[],
  outfile: string,
  tsConfigPath: string,
  mappedPaths: MappedPath[],
  plugins: esbuild.Plugin[] | null = null,
  absWorkingDir: string | undefined = undefined
) {
  await esbuild.build({
    entryPoints: [entryPoint],
    external,
    // absWorkingDir,
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
