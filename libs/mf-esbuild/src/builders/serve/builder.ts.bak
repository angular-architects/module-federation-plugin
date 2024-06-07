// import {
//   BuilderContext,
//   BuilderOutput,
//   createBuilder,
// } from '@angular-devkit/architect';

// import { setTweaks, builder  } from '@angular-architects/build-angular/src/builders/dev-server';
// import { FederationOptions, getExternals, loadFederationConfig } from '@softarc/native-federation/build';
// import * as path from 'path';
// import { createAngularBuildAdapter } from '../../utils/angular-esbuild-adapter';
// import { targetFromTargetString } from '@angular-devkit/architect';
// import { Subject, lastValueFrom } from 'rxjs';
// import { federation } from '../../plugin';

// import { watch } from 'chokidar';

// export async function runBuilder(
//   options: any,
//   context: BuilderContext
// ): Promise<BuilderOutput> {

//   const target = targetFromTargetString(options.browserTarget);
//   const targetOptions = await context.getTargetOptions(target) as any;

//   const projectDir = path.dirname(targetOptions.tsConfig);
//   const federationConfig = path.join(projectDir, 'federation.config.js');

//   const fedOptions: FederationOptions = {
//     workspaceRoot: context.workspaceRoot,
//     outputPath: targetOptions.outputPath,
//     tsConfig: targetOptions.tsConfig,
//     federationConfig,
//     watch: true,
//   };

//   const config = await loadFederationConfig(fedOptions);
//   const externals = getExternals(config);

//   const rebuildRequested = new Subject<void>();

//   const plugin = await federation({
//     options: fedOptions,
//     adapter: createAngularBuildAdapter(targetOptions, context)
//   });

//   setTweaks({ externals, plugin });

//   const fullOutputPath = path.join(context.workspaceRoot, targetOptions.outputPath);
//   watch(fullOutputPath, { useFsEvents: true, usePolling: true }).on('all', (event, path) => {
//     console.log('output changed', event, path);
//     rebuildRequested.next();
//   });

//   return await lastValueFrom(builder(options, context as any, {}));
// }

// export default createBuilder(runBuilder);
