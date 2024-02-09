import * as path from 'path';
import * as fs from 'fs';
import * as mrmime from 'mrmime';
import { Connect } from 'vite';
import { I18nOptions } from '@angular-devkit/build-angular/src/utils/i18n-options';
import { FederationOptions } from '@softarc/native-federation/build';

export function getFederationFilesMiddleware(
  fedOptions: FederationOptions,
  i18nOpts: I18nOptions,
): Connect.NextHandleFunction {
  const localeRootRegExp = getLocaleRootRegexp(i18nOpts);

  return (req, res, next) => {
    const fileName = path.join(
      fedOptions.workspaceRoot,
      fedOptions.outputPath,
      mapLocaleHrefToDir(i18nOpts, req.url),
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
  return baseHref
    .split('/')
    .filter((s) => s != '')
    .join('/');
}

function mapLocaleHrefToDir(i18nOpts: I18nOptions, url: string) {
  if (!Object.entries(i18nOpts.locales).length) {
    return url;
  }
  let startsWithHref: RegExp;
  const entry = Object.entries(i18nOpts.locales).find(([, { baseHref }]) => {
    const href = trimHref(baseHref);
    startsWithHref = new RegExp(`^(\/?)${href}(\/?.*)$`);
    return startsWithHref.test(url);
  });
  if (!entry) {
    return url;
  }
  const [locale] = entry;
  return url.replace(startsWithHref, `$1${locale}$2`);
}

function getLocaleRootRegexp(i18nOpts: I18nOptions): RegExp {
  const localeDirs = Object.values(i18nOpts.locales)
    .map(({ baseHref }) => trimHref(baseHref))
    .filter((href) => href !== '');
  return i18nOpts.shouldInline
    ? new RegExp(`^\/?(?:${localeDirs.join('|')})\/?$`)
    : new RegExp(/^\/?$/);
}
