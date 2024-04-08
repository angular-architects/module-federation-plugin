import {
  FederationOptions,
  writeFederationInfo,
  writeImportMap,
} from '@softarc/native-federation/build';
import { AngularBuildOutput } from './angular-esbuild-adapter';
import { updateIndexHtml } from './updateIndexHtml';
import {
  BuildOutputFile,
  BuildOutputFileType,
} from '@angular-devkit/build-angular/src/tools/esbuild/bundler-context';
import { JsonObject } from '@angular-devkit/core';
import * as path from 'path';
import * as fs from 'fs';
import { Schema } from '@angular-devkit/build-angular/src/builders/application/schema';
import { FederationInfo } from '@softarc/native-federation-runtime';
import { I18nOptions } from '@angular-devkit/build-angular/src/utils/i18n-options';
import { EsBuildResult, MemResults } from './mem-resuts';

// assuming that the files have already been written
export function prepareBundles(
  options: JsonObject & Schema,
  fedOptions: FederationOptions,
  i18nOptions: I18nOptions,
  buildOutput: AngularBuildOutput,
  shouldWriteIndex: boolean,
  memResults: MemResults
): void {
  const metaDataPath = path.join(
    fedOptions.workspaceRoot,
    fedOptions.outputPath,
    'remoteEntry.json'
  );
  const federationInfo = JSON.parse(
    fs.readFileSync(metaDataPath, 'utf-8')
  ) as FederationInfo;
  const indexFiles = getIndexFiles(
    options,
    fedOptions,
    i18nOptions,
    buildOutput
  );
  // in case there is only a single locale, just update the index html, or add debug info.
  if (!i18nOptions.shouldInline) {
    if (shouldWriteIndex) {
      updateIndexHtml(fedOptions, indexFiles[0]);
    } else {
      // dev server mode
      federationInfo.shared.push(
        ...federationInfo.shared.map((share) => ({
          ...share,
          packageName: `/@id/${share.packageName}`,
        }))
      );
      writeFederationInfo(federationInfo, fedOptions);
      const fedOutput = {
        path: path.join(fedOptions.outputPath, 'remoteEntry.json'),
        contents: Buffer.from(JSON.stringify(federationInfo, null, 2)),
        type: BuildOutputFileType.Browser,
        text: JSON.stringify(federationInfo, null, 2),
        clone: function close() {
          return { ...this };
        },
        hash: '',
        fullOutputPath: path.join(
          fedOptions.workspaceRoot,
          fedOptions.outputPath,
          'remoteEntry.json'
        )
      };
      memResults.add([new EsBuildResult(fedOutput, path.join(fedOptions.workspaceRoot, fedOptions.outputPath))]);
    }
    return;
  }
  for (const indexFile of getIndexFiles(
    options,
    fedOptions,
    i18nOptions,
    buildOutput
  )) {
    if (shouldWriteIndex) {
      updateIndexHtml(fedOptions, indexFile);
    }
    const locale = path.dirname(indexFile.path);
    addFederationInfoToBundle(
      federationInfo,
      fedOptions,
      locale,
      i18nOptions.locales[locale].baseHref,
      !shouldWriteIndex,
      memResults
    );
  }
}

function getIndexFiles(
  options: JsonObject & Schema,
  fedOptions: FederationOptions,
  i18nOptions: I18nOptions,
  buildOutput: AngularBuildOutput
): BuildOutputFile[] {
  const indexName =
    typeof options.index == 'string'
      ? path.basename(options.index)
      : (options.index as any).output || 'index.html';

  if (buildOutput.outputFiles) {
    return buildOutput.outputFiles.filter(
      (file) =>
        file.path.endsWith(indexName) &&
        file.type == BuildOutputFileType.Browser
    );
  } else {
    return getIndexBuildOutput(indexName, i18nOptions, fedOptions);
  }
}

function localizeFederationInfo(
  fedInfo: FederationInfo,
  devServerMode: boolean,
  baseHref: string
): FederationInfo {
  // shared entries are not localized. We don't copy them to locale folders to save space
  // but this means we have to map the items in federation info, to point up 1 level.
  // exposed entries need no transformation, they were basenames, and they got localized
  const localizedFedInfo = cloneFederationInfo(fedInfo);
  const pathCorrection = '../';
  localizedFedInfo.shared = fedInfo.shared.flatMap((share) =>
    getAliases(share.packageName, baseHref, devServerMode).map((alias) => ({
      ...share,
      outFileName: pathCorrection + share.outFileName,
      packageName: alias,
    }))
  );
  return localizedFedInfo;
}

function getAliases(
  packageName: string,
  baseHref: string,
  devServerMode: boolean
): string[] {
  const aliases = [packageName, baseHref + packageName];
  if (devServerMode) {
    aliases.push(`/@id/${packageName}`, `${baseHref}@id/${packageName}`);
  }
  return aliases;
}

function addFederationInfoToBundle(
  fedInfo: FederationInfo,
  fedOptions: FederationOptions,
  locale: string,
  baseHref: string,
  devServerMode: boolean,
  memResults: MemResults
) {
  const localizedFedInfo = localizeFederationInfo(
    fedInfo,
    devServerMode,
    baseHref
  );
  const localeOutputPath = path.join(fedOptions.outputPath, locale);
  const localizedFedOptions: FederationOptions = {
    ...fedOptions,
    outputPath: localeOutputPath,
  };
  // in devserver mode these could be the first files going in the output path when building a host
  if (!fs.existsSync(localeOutputPath)) {
    fs.mkdirSync(localeOutputPath, { recursive: true });
  }
  writeFederationInfo(localizedFedInfo, localizedFedOptions);
  writeImportMap(localizedFedInfo.shared, localizedFedOptions);
  const fedOutput = {
    path: path.join(fedOptions.outputPath, 'remoteEntry.json'),
    contents: Buffer.from(JSON.stringify(localizedFedInfo, null, 2)),
    type: BuildOutputFileType.Browser,
    text: JSON.stringify(localizedFedInfo, null, 2),
    clone: function close() {
      return { ...this };
    },
    hash: '',
    fullOutputPath: path.join(
      fedOptions.workspaceRoot,
      fedOptions.outputPath,
      'remoteEntry.json'
    )
  };
  const imports = localizedFedInfo.shared.reduce((acc, cur) => {
    return {
      ...acc,
      [cur.packageName]: cur.outFileName,
    };
  }, {});

  const importMap = { imports };
  const mapOutput = {
    path: path.join(localizedFedOptions.outputPath, 'importmap.json'),
    contents: Buffer.from(JSON.stringify(importMap, null, 2)),
    type: BuildOutputFileType.Browser,
    text: JSON.stringify(importMap, null, 2),
    clone: function close() {
      return { ...this };
    },
    hash: '',
    fullOutputPath: path.join(
      localizedFedOptions.workspaceRoot,
      localizedFedOptions.outputPath,
      'importmap.json'
    )
  };
  memResults.add([new EsBuildResult(fedOutput, path.join(fedOptions.workspaceRoot, localizedFedOptions.outputPath))]);
  memResults.add([new EsBuildResult(mapOutput, path.join(fedOptions.workspaceRoot, localizedFedOptions.outputPath))]);
}

function cloneFederationInfo(fedInfo: FederationInfo): FederationInfo {
  return {
    name: fedInfo.name,
    exposes: fedInfo.exposes.map((exp) => ({ ...exp })),
    shared: fedInfo.shared.map((share) => ({ ...share })),
  };
}

function getIndexBuildOutput(
  indexName: string,
  i18nOptions: I18nOptions,
  fedOptions: FederationOptions
): BuildOutputFile[] {
  var locales: string[];
  if (i18nOptions.shouldInline) {
    locales = [...i18nOptions.inlineLocales.keys()];
  } else {
    locales = [i18nOptions.sourceLocale];
  }
  return locales.map((locale) => {
    const pathSegments = [fedOptions.workspaceRoot, fedOptions.outputPath];
    if (i18nOptions.shouldInline) {
      pathSegments.push(locale);
    }
    pathSegments.push(indexName);

    return {
      type: BuildOutputFileType.Browser,
      path: i18nOptions.shouldInline ? path.join(locale, indexName) : indexName,
      get text() {
        return fs.readFileSync(path.join(...pathSegments), 'utf-8');
      },
      // the rest are unused anyway
      get contents() {
        return Uint8Array.from(fs.readFileSync(path.join(...pathSegments)))
      },
      clone: function clone() {
        return { ...this };
      },
      hash: '',
      fullOutputPath: '',
    };
  });
}
