import * as path from 'path';
import * as fs from 'fs';
import * as mrmime from 'mrmime';
import { Connect } from 'vite';
import { I18nOptions } from '@angular-devkit/build-angular/src/utils/i18n-options';
import { FederationOptions } from '@softarc/native-federation/build';

export function getFederationFilesMiddleware(
  fedOptions: FederationOptions,
  i18nOpts: I18nOptions,
  pathMappings?: [string, string][]
): Connect.NextHandleFunction {
  const localeRootRegExp = getLocaleRootRegexp(i18nOpts);
  const pathMapper = getPathMapper(i18nOpts, pathMappings);

  return (req, res, next) => {
    const fileName = path.join(
      fedOptions.workspaceRoot,
      fedOptions.outputPath,
      mapLocaleHrefToDir(pathMapper, req.url)
    );
    const exists = fs.existsSync(fileName);
    if (
      req.url !== '/' &&
      req.url !== '' &&
      !req.url.endsWith('polyfills.js') &&
      !localeRootRegExp.test(req.url) &&
      exists
    ) {
      const lookup = mrmime.lookup;
      const mimeType = lookup(path.extname(fileName)) || 'text/javascript';
      const body = fs.readFileSync(fileName, 'utf-8');
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
  };
}

function trimHref(baseHref: string): string {
  return (
    baseHref
      ?.split('/')
      ?.filter((s) => s != '')
      ?.join('/') ?? ''
  );
}

function mapLocaleHrefToDir(pathMapper: [RegExp, string][], url: string) {
  const [matcher, replacement] = pathMapper.find(([matcher]) => matcher.test(url)) ?? [null, null];
  if (!matcher) {
    return url;
  }
  return url.replace(matcher, replacement);
}

function getLocaleRootRegexp(i18nOpts: I18nOptions): RegExp {
  const localeDirs = Object.entries(i18nOpts.locales)
    .map(([locale, { baseHref }]) => {
      return trimHref(baseHref) || locale;
    })
    .filter((href) => href !== '');
  return i18nOpts.shouldInline
    ? new RegExp(`(?:^|\/)(?:${localeDirs.join('|')})\/?$`)
    : new RegExp(/^\/?$/);
}

function getPathMapper(i18nOpts: I18nOptions, pathMappings?: [string, string][]): [RegExp, string][] {
  if (pathMappings && typeof pathMappings == 'object') {
    return pathMappings.map(([regexp, replacement]) => [new RegExp(regexp), replacement]);
  } else {
    if (!i18nOpts || !i18nOpts.locales || !Object.entries(i18nOpts.locales).length || !i18nOpts.shouldInline) {
      return [];
    }
    return Object.entries(i18nOpts.locales)
      .filter(([, opts]) => opts.baseHref)
      .map(([loc, opts]) => [new RegExp(`^(\/??)${trimHref(opts.baseHref)}(\/?.*)$`), `$1${loc}$2`]);
  }
}
