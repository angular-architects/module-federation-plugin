import { FederationOptions, writeFederationInfo, writeImportMap } from '@softarc/native-federation/build';
import { AngularBuildOutput } from './angular-esbuild-adapter';
import { updateIndexHtml } from './updateIndexHtml';
import { BuildOutputFile, BuildOutputFileType } from '@angular-devkit/build-angular/src/tools/esbuild/bundler-context';
import { JsonObject } from '@angular-devkit/core';
import * as path from 'path';
import * as fs from 'fs';
import { Schema } from '@angular-devkit/build-angular/src/builders/application/schema';
import { FederationInfo } from '@softarc/native-federation-runtime';

// assuming that the files have already been written
export function prepareBundles(
  options: JsonObject & Schema,
  fedOptions: FederationOptions,
  buildOutput: AngularBuildOutput
): void {
  
  const metaDataPath = path.join(
    fedOptions.workspaceRoot,
    fedOptions.outputPath,
    'remoteEntry.json'
  );
  const federationInfo = JSON.parse(fs.readFileSync(metaDataPath, 'utf-8')) as FederationInfo;

  for (const indexFile of getIndexFiles(options, buildOutput)) {
    updateIndexHtml(fedOptions, indexFile);
    addFederationInfoToBundle(
      cloneFederationInfo(federationInfo),
      fedOptions,
      path.dirname(indexFile.path));
  }
}

function getIndexFiles(
  options: JsonObject & Schema,
  buildOutput: AngularBuildOutput): BuildOutputFile[] {

  const indexName = typeof options.index == 'string' 
    ? path.basename(options.index)
    : (options.index as any).output || 'index.html';
    
  return buildOutput.outputFiles.filter((file) =>
    file.path.endsWith(indexName) &&
    file.type == BuildOutputFileType.Browser
  );
}

function addFederationInfoToBundle(fedInfo: FederationInfo, fedOptions: FederationOptions, locale: string) {
  // shared entries are not localized. We don't copy them to locale folders to save space
  // but this means we have to map the items in federation info, to point up 1 level.
  // exposed entries need no transformation, they were basenames, and they got localized
  const newShared = fedInfo.shared.map((share) => ({
    ...share,
    outFileName: path.join(
      '..',
      share.outFileName
    )
  }));
  fedInfo.shared = newShared;
  const localizedFedOptions: FederationOptions = {
    ...fedOptions,
    outputPath: path.join(
      fedOptions.outputPath,
      locale
    )
  }
  writeFederationInfo(fedInfo, localizedFedOptions)
  writeImportMap(newShared, localizedFedOptions);
}

function cloneFederationInfo(fedInfo: FederationInfo): FederationInfo {
  return {
    name: fedInfo.name,
    exposes: fedInfo.exposes.map(exp => ({ ...exp })),
    shared: fedInfo.shared.map(share => ({ ...share }))
  };
}
