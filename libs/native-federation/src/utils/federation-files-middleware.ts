import * as path from 'path';
import * as fs from 'fs';
import * as mrmime from 'mrmime';
import { Connect } from 'vite';
import { I18nOptions } from '@angular-devkit/build-angular/src/utils/i18n-options';
import { FederationOptions } from '@softarc/native-federation/build';

export function getFederationFilesMiddleware(
  fedOptions: FederationOptions,
  i18nOpts: I18nOptions
): Connect.NextHandleFunction {
  const localeRootRegExp = getLocaleRootRegexp(i18nOpts);

  return (req, res, next) => {
    const fileName = path.join(
      fedOptions.workspaceRoot,
      fedOptions.outputPath,
      mapLocaleHrefToDir(i18nOpts, req.url)
    );
    console.log('######### request');
    console.log(req.url);
    console.log(fileName);
    const exists = fs.existsSync(fileName);
    console.log(exists);
    console.log(!localeRootRegExp.test(req.url));
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

function mapLocaleHrefToDir(i18nOpts: I18nOptions, url: string) {
  if (!Object.entries(i18nOpts.locales).length || !i18nOpts.shouldInline) {
    return url;
  }
  let startsWithHref: RegExp;
  const entry = Object.entries(i18nOpts.locales).find(([locale, { baseHref }]) => {
    const href = trimHref(baseHref);
    if (href) {
      startsWithHref = new RegExp(`^(\/?)${href}(\/?.*)$`);
    } else {
      startsWithHref = new RegExp(`^\/?(?:start-page|example)(\/)${locale}(\/.*|)$`);
    }
    return startsWithHref.test(url);
  });
  if (!entry) {
    if (url.split('/').length > 2) {
      return url.replace(/^\/?(?:start-page|example)/, ''); // TODO: WORKAROUND FOR NOW: CUT OFF FIRST SEGMENT
    } else {
      return url;
    }
  }
  const [locale] = entry;
  url.replace(startsWithHref, `$1${locale}$2`);
  return url.replace(startsWithHref, `$1${locale}$2`);
}

function getLocaleRootRegexp(i18nOpts: I18nOptions): RegExp {
  const localeDirs = Object.entries(i18nOpts.locales).map(([locale, { baseHref }]) => {
    return trimHref(baseHref) || locale;
  }).filter((href) => href !== '');
  return i18nOpts.shouldInline
    ? new RegExp(`(?:^|\/)(?:${localeDirs.join('|')})\/?$`)
    : new RegExp(/^\/?$/);
}
