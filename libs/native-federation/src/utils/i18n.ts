import { BuilderContext } from '@angular-devkit/architect';
import { logger } from '@softarc/native-federation/build';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { FederationInfo } from '@softarc/native-federation-runtime';

export type WorkspaceConfig = {
  i18n?: I18nConfig;
};

export type LocaleTranslation = string | string[];

export type LocaleObject = {
  translation: LocaleTranslation;
  baseHref?: string;
  subPath?: string;
};

export type I18nConfig = {
  sourceLocale: string | SourceLocaleObject;
  locales: Record<string, LocaleTranslation | LocaleObject>;
};

export type SourceLocaleObject = {
  code: string;
  baseHref?: string;
  subPath?: string;
};

export async function getI18nConfig(
  context: BuilderContext
): Promise<I18nConfig | undefined> {
  const workspaceConfig = (await context.getProjectMetadata(
    context.target?.project || ''
  )) as WorkspaceConfig;

  const i18nConfig = workspaceConfig?.i18n;
  return i18nConfig;
}

export async function translateFederationArtefacts(
  i18n: I18nConfig,
  localize: boolean | string[],
  outputPath: string,
  federationResult: FederationInfo
) {
  const neededLocales = Array.isArray(localize)
    ? localize
    : Object.keys(i18n.locales);

  const locales = Object.keys(i18n.locales).filter((locale) =>
    neededLocales.includes(locale)
  );

  if (locales.length === 0) {
    return;
  }

  logger.info('Writing Translations');

  const translationFiles = locales
    .map((loc) => i18n.locales[loc])
    .map((config) => typeof config === 'string' || Array.isArray(config) ? config : config.translation)
    .map((files) => JSON.stringify(files))
    .join(' ');

  const targetLocales = locales.join(' ');

  const sourceLocale =
    typeof i18n.sourceLocale === 'string'
      ? i18n.sourceLocale
      : i18n.sourceLocale.code;

  const translationOutPath = path.join(outputPath, 'browser', '{{LOCALE}}');

  const federationFiles = [
    ...federationResult.shared.map((s) => s.outFileName),
    ...federationResult.exposes.map((e) => e.outFileName),
  ];

  // Here, we use a glob with an exhaustive list i/o `"*.js"`
  // to improve performance
  const sourcePattern = '{' + federationFiles.join(',') + '}';

  const sourceLocalePath = path.join(outputPath, 'browser', sourceLocale);

  const localizeTranslate = path.resolve("node_modules/.bin/localize-translate");

  const cmd = `${localizeTranslate} -r ${sourceLocalePath} -s "${sourcePattern}" -t ${translationFiles} -o ${translationOutPath} --target-locales ${targetLocales} -l ${sourceLocale}`;

  ensureDistFolders(locales, outputPath);
  copyRemoteEntry(locales, outputPath, sourceLocalePath);

  logger.debug('Running: ' + cmd);

  execCommand(cmd, 'Successfully translated');
}

function execCommand(cmd: string, defaultSuccessInfo: string) {
  try {
    const output = execSync(cmd);
    logger.info(output.toString() || defaultSuccessInfo);
  } catch (error) {
    logger.error(error.message);
  }
}

function copyRemoteEntry(
  locales: string[],
  outputPath: string,
  sourceLocalePath: string
) {
  const remoteEntry = path.join(sourceLocalePath, 'remoteEntry.json');

  for (const locale of locales) {
    const localePath = path.join(
      outputPath,
      'browser',
      locale,
      'remoteEntry.json'
    );
    fs.copyFileSync(remoteEntry, localePath);
  }
}

function ensureDistFolders(locales: string[], outputPath: string) {
  for (const locale of locales) {
    const localePath = path.join(outputPath, 'browser', locale);
    fs.mkdirSync(localePath, { recursive: true });
  }
}
