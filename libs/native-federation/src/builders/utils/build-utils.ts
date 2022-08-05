import * as esbuild from 'esbuild';
import {createCompilerPlugin }
  from '@angular-devkit/build-angular/src/builders/browser-esbuild/compiler-plugin';

// const path = require('path');

// const shareConfig = [
//   {
//     entryPoint:
//       "node_modules/@angular/platform-browser/fesm2020/platform-browser.mjs",
//     packageName: "@angular/platform-browser",
//   },
//   {
//     entryPoint: "node_modules/@angular/core/fesm2020/core.mjs",
//     packageName: "@angular/core",
//   },
//   {
//     entryPoint: "node_modules/@angular/common/fesm2020/common.mjs",
//     packageName: "@angular/common",
//   },
//   {
//     entryPoint: "node_modules/@angular/common/fesm2020/http.mjs",
//     packageName: "@angular/common/http",
//   },
//   {
//     entryPoint: "node_modules/rxjs/dist/esm/index.js",
//     packageName: "rxjs",
//   },
//   {
//     entryPoint: "node_modules/rxjs/dist/esm/operators/index.js",
//     packageName: "rxjs/operators",
//   },
//   {
//     entryPoint: "projects/shared/src/public-api.ts",
//     packageName: "@demo/shared",
//   },  
// ];

// const exposes = {
//     "comp1": "./projects/mfe1/src/app/comp1/comp1.component.ts",
//     "comp2": "./projects/mfe1/src/app/comp2/comp2.component.ts",
// };

// const outDir = `dist/cli14`;

// const appName = 'shell';

// (async function () {
//   const external = shareConfig.map((e) => e.packageName);

//   const map = {};
//   const meta = {
//     name: appName,
//     exposes: {},
//     shared: {},
//   };
//   const tsConfigPath = '';
  
  // for (const key in exposes) {
  //   const outfile = key + '.js';
  //   const outFilePath = path.join(outDir, outFile);
  //   const entryPoint = exposes[key];
  //   await bundle({ entryPoint, tsConfigPath, external, outfile });

  //   map[`mfe1/${key}`] = `./${outFile}`;
  //   meta.exposes[key] = `${outFile}`;
//   }

//   for (const entry of shareConfig) {
//     const fileName = entry.packageName.replace(/[^A-Za-z0-9]/g, "_");
//     const outFile = `dist/cli14/${fileName}.js`;
//     const entryPoints = [entry.entryPoint];

//     await bundle({ entryPoint: entryPoints, tsConfigPath: external, external: outFile });

//     map[entry.packageName] = `./${fileName}.js`;
//     meta.shared[entry.packageName] = {
//       fileName: `${fileName}.js`,
//       // version: 'TODO'
//     };
//   }

//   console.log(JSON.stringify({ imports: map}, null, 2));
//   console.log(JSON.stringify( meta, null, 2));


// })();

export async function bundle({ entryPoint, tsConfigPath, external, outfile }: { entryPoint: string; tsConfigPath: string; external: Array<string>; outfile: string; }) {
    await esbuild.build({
        entryPoints: [entryPoint],
        external,
        outfile,
        bundle: true,
        sourcemap: true,
        minify: true,
        format: "esm",
        target: ["esnext"],
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
        ],
    });
}
