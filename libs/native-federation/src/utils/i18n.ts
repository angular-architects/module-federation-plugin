import { BuilderContext } from '@angular-devkit/architect';
import {
  logger,
  NormalizedFederationConfig,
} from '@softarc/native-federation/build';
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
  context: BuilderContext,
): Promise<I18nConfig | undefined> {
  const workspaceConfig = (await context.getProjectMetadata(
    context.target?.project || '',
  )) as WorkspaceConfig;

  const i18nConfig = workspaceConfig?.i18n;
  return i18nConfig;
}

export async function translateFederationArtefacts(
  i18n: I18nConfig,
  localize: boolean | string[],
  outputPath: string,
  federationResult: FederationInfo,
) {
  const neededLocales = Array.isArray(localize)
    ? localize
    : Object.keys(i18n.locales);

  const locales = Object.keys(i18n.locales).filter((locale) =>
    neededLocales.includes(locale),
  );

  if (locales.length === 0) {
    return;
  }

  logger.info('Writing Translations');

  const translationFiles = locales
    .map((loc) => i18n.locales[loc])
    .map((config) =>
      typeof config === 'string' || Array.isArray(config)
        ? config
        : config.translation,
    )
    .map((files) => JSON.stringify(files))
    .join(' ');

  const targetLocales = locales.join(' ');

  const sourceLocale =
    typeof i18n.sourceLocale === 'string'
      ? i18n.sourceLocale
      : i18n.sourceLocale.code;

  const translationOutPath = path.join(outputPath, 'browser', '{{LOCALE}}');

  // Use *.js to translate ALL JS files, including lazy-loaded chunks
  // that may contain $localize markers from exposed modules
  const sourcePattern = '*.js';

  const sourceLocalePath = path.join(outputPath, 'browser', sourceLocale);

  const localizeTranslate = path.resolve(
    'node_modules/.bin/localize-translate',
  );

  // Quote paths to handle spaces (Windows compatibility)
  const cmd = `"${localizeTranslate}" -r "${sourceLocalePath}" -s "${sourcePattern}" -t ${translationFiles} -o "${translationOutPath}" --target-locales ${targetLocales} -l ${sourceLocale}`;

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
  sourceLocalePath: string,
) {
  const remoteEntry = path.join(sourceLocalePath, 'remoteEntry.json');

  for (const locale of locales) {
    const localePath = path.join(
      outputPath,
      'browser',
      locale,
      'remoteEntry.json',
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

const LOCALE_DATA_BASE_MODULE = '@angular/common/locales/global';

// Angular's framework ships `en`/`en-US` data inline; the locale-data plugin
// short-circuits these and never emits a bare specifier for them.
// See: @angular/build/src/tools/esbuild/i18n-locale-plugin.ts
function isBuiltInEnglishLocale(code: string): boolean {
  return code === 'en' || code === 'en-US';
}

export type ResolvedLocaleData = {
  /** Bare specifier emitted by Angular, e.g. "@angular/common/locales/global/de-CH" */
  packageName: string;
  /** Path to the locale data file, relative to the workspace root */
  entryPoint: string;
  /** The locale tag that actually matched on disk (may be a prefix of the request) */
  matchedCode: string;
  /** Version of @angular/common (for cache busting / packageInfo) */
  version: string;
};

/**
 * Resolves the `@angular/common/locales/global/<code>` file on disk, mirroring
 * Angular's own progressive locale-tag fallback (de-CH → de).
 */
export function resolveAngularLocaleData(
  code: string,
  workspaceRoot: string,
): ResolvedLocaleData | null {
  if (!code || isBuiltInEnglishLocale(code)) {
    return null;
  }

  const angularCommonRoot = path.join(
    workspaceRoot,
    'node_modules',
    '@angular',
    'common',
  );
  let version = '0.0.0';
  const pkgJsonPath = path.join(angularCommonRoot, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      version =
        JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')).version ?? version;
    } catch {
      // ignore – fall back to the placeholder version
    }
  }

  let partial = code;
  while (partial) {
    for (const ext of ['.js', '.mjs']) {
      const rel = path.posix.join(
        'node_modules',
        '@angular',
        'common',
        'locales',
        'global',
        `${partial}${ext}`,
      );
      const abs = path.join(workspaceRoot, rel);
      if (fs.existsSync(abs)) {
        return {
          packageName: `${LOCALE_DATA_BASE_MODULE}/${partial}`,
          entryPoint: rel,
          matchedCode: partial,
          version,
        };
      }
    }

    const parts = partial.split('-');
    if (parts.length <= 1) {
      break;
    }
    partial = parts.slice(0, -1).join('-');
  }

  return null;
}

/**
 * When Angular's `@angular/build:application` builder is configured with a
 * non-English `i18n.sourceLocale` (or runs a single inline locale via the dev
 * server), its esbuild i18n-locale-plugin emits bare external imports of the
 * form `@angular/common/locales/global/<code>` that vite's dep-prebundling is
 * expected to resolve at runtime. Native Federation replaces that resolution
 * layer with its own importmap, so the bare specifier ends up unresolved in
 * the browser.
 *
 * This helper compensates by injecting the locale data files as shared chunks
 * into the federation config *after* normalization (i.e. after `filterShared`
 * has already run), so the bundler emits them and `writeImportMap` lists
 * them.
 *
 * Returns the list of package names that were registered, primarily for
 * diagnostics and tests.
 */
export function registerAngularLocaleDataInFederationConfig(
  config: NormalizedFederationConfig,
  i18n: I18nConfig | undefined,
  workspaceRoot: string,
  inlineLocales: readonly string[] = [],
): string[] {
  if (!i18n) {
    return [];
  }

  const sourceCode =
    typeof i18n.sourceLocale === 'string'
      ? i18n.sourceLocale
      : i18n.sourceLocale?.code;

  const candidates = new Set<string>();
  if (sourceCode) {
    candidates.add(sourceCode);
  }
  for (const loc of inlineLocales) {
    candidates.add(loc);
  }

  const registered: string[] = [];

  for (const code of candidates) {
    if (isBuiltInEnglishLocale(code)) {
      continue;
    }

    const resolved = resolveAngularLocaleData(code, workspaceRoot);
    if (!resolved) {
      logger.warn(
        `Could not locate '${LOCALE_DATA_BASE_MODULE}/${code}' in node_modules. ` +
          `The browser will not be able to resolve this bare specifier at runtime. ` +
          `Verify that @angular/common is installed, or share the locale data manually via federation.config.js.`,
      );
      continue;
    }

    if (config.shared[resolved.packageName]) {
      // User has already shared this entry explicitly – leave it alone.
      continue;
    }

    config.shared[resolved.packageName] = {
      singleton: true,
      strictVersion: false,
      requiredVersion: 'auto',
      platform: 'browser',
      build: 'default',
      packageInfo: {
        entryPoint: resolved.entryPoint,
        version: resolved.version,
        esm: true,
      },
    };
    registered.push(resolved.packageName);
  }

  return registered;
}
