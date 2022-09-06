import { BuildAdapter } from '@softarc/native-federation/build';
import * as esbuild from 'esbuild';
import { createCompilerPlugin } from '@angular-devkit/build-angular/src/builders/browser-esbuild/compiler-plugin';
import { createSharedMappingsPlugin } from './shared-mappings-plugin';
import { prepareNodePackage } from './prepare-node-package';

const SKIP_PACKAGE_PREPARATION = ['@angular', '@ngrx', 'rxjs', 'zone.js'];

export const AngularEsBuildAdapter: BuildAdapter = async (options) => {
  const { entryPoint, tsConfigPath, external, outfile, mappedPaths, packageName } = options;

  const pNameOrEmpty = packageName ?? '';

  const preparePackage = entryPoint.includes("node_modules")
    &&  !SKIP_PACKAGE_PREPARATION.find(p => pNameOrEmpty?.split('/')[0] === p);

  const pkgName = preparePackage ? inferePkgName(entryPoint) : "";
  const tmpFolder = `node_modules/.tmp/native-federation/${pkgName}`;

  if (preparePackage) {
    await prepareNodePackage(entryPoint, external, tmpFolder);
  }

  await esbuild.build({
    entryPoints: [entryPoint],
    external,
    outfile,
    bundle: true,
    sourcemap: true,
    minify: true,
    platform: 'node',
    format: 'esm',
    target: ['esnext'],
    plugins: [
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
};

function inferePkgName(entryPoint: string) {
  return entryPoint
    .replace(/.*?node_modules/g, "")
    .replace(/[^A-Za-z0-9.]/g, "_");
}

