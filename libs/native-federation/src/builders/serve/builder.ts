import { ExecutorContext, parseTargetString, readTargetOptions } from '@nx/devkit';
import type { Plugin } from 'esbuild';

import { executeDevServer } from '@angular/build/src/builders/dev-server/';
import { Schema } from '@angular/build/src/builders/dev-server/schema';
import { eachValueFrom } from '@nx/devkit/src/utils/rxjs-for-await';
import { FederationInfo } from '@softarc/native-federation-runtime';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { lookup } from 'mrmime';
import { extname, join } from 'path';
import { Connect } from 'vite';
import { entryPointsPlugin } from '../../utils/entry-points-plugin';
import { externalsPlugin } from '../../utils/externals-plugin';
import { initFederationBuild } from '../../utils/init-federation-build';
import { createSharedMappingsPlugin } from '../../utils/shared-mappings-plugin';
import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';
import { transformIndexHtml } from '../../utils/updateIndexHtml';


export async function* serveNativeFederation(options: Schema, context: BuilderContext) {
  options.watch = true;
  options.liveReload = true;

  const buildTarget = parseTargetString(options.buildTarget, context.projectGraph)
  const buildOptions = readTargetOptions(buildTarget, context);

  const outdir = typeof buildOptions.outputPath === 'string' ? buildOptions.outputPath : buildOptions.outputPath.base;
  const browserOutDir = outdir + '/browser';

  if (existsSync(browserOutDir)) {
    rmSync(browserOutDir, { recursive: true });
  }

  if (!existsSync(browserOutDir)) {
    mkdirSync(browserOutDir, { recursive: true });
  }

  const fedData = await initFederationBuild(context.workspaceRoot, browserOutDir, buildOptions.tsConfig);

  const plugins: Plugin[] = [
    entryPointsPlugin(fedData.entries),
    createSharedMappingsPlugin(fedData.sharedMappings),
    externalsPlugin(fedData.externals),
  ];

  const middleware: Connect.NextHandleFunction[] = [
    returnRemoteEntryFromFs(context.workspaceRoot, browserOutDir),
  ];

  const ngDevServer = executeDevServer(
    options,
    context,
    { indexHtml: transformIndexHtml() },
    {
      middleware,
      buildPlugins: plugins,
      builderSelector: () => '@angular-devkit/build-angular:application',
    }
  );

  return yield* eachValueFrom(ngDevServer);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default createBuilder(serveNativeFederation) as any;

function returnRemoteEntryFromFs(workspaceRoot: string, browserOutDir: string): Connect.NextHandleFunction {
  return (req, res, next) => {
    const fileName = join(
      workspaceRoot,
      browserOutDir,
      req.url
    );
    const exists = existsSync(fileName);
  
    if (req.url === '/remoteEntry.json' && exists) {
      const mimeType = lookup(extname(fileName)) || 'text/javascript';
      const rawBody = readFileSync(fileName, 'utf-8');
      const body = addDebugInformation(req.url, rawBody);
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end(body);
    } else {
      next();
    }
  }
}

function addDebugInformation(fileName: string, rawBody: string): string {
  const remoteEntry = JSON.parse(rawBody) as FederationInfo;
  const shared = remoteEntry.shared;

  if (!shared) {
    return rawBody;
  }

  const sharedForVite = shared.map((s) => ({
    ...s,
    packageName: `/@id/${s.packageName}`,
  }));

  remoteEntry.shared = [...shared, ...sharedForVite];

  return JSON.stringify(remoteEntry, null, 2);
}