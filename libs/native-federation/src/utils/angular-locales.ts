import { share, SharedConfig } from '@softarc/native-federation/build';

export function shareAngularLocales(
  keys: string[],
  opts: { config?: SharedConfig; legacy?: boolean } = {},
) {
  if (!opts.config) {
    opts.config = {
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    };
  }
  const ext = opts.legacy ? '.mjs' : '.js';
  return keys.reduce((acc, key) => {
    acc[`@angular/common/locales/${key}`] = {
      ...opts.config!,
      packageInfo: opts.config.packageInfo || {
        ...opts.config.packageInfo,
        entryPoint:
          opts.config.packageInfo?.entryPoint ||
          `node_modules/@angular/common/locales/${key}${ext}`,
      },
    };
    return share(acc);
  }, {});
}
