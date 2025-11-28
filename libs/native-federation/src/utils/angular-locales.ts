import { share, SharedConfig } from '@softarc/native-federation/build';

export function shareAngularLocales(
  keys,
  config: SharedConfig = {
    singleton: true,
    strictVersion: true,
    requiredVersion: 'auto',
  },
) {
  return keys.reduce((acc, key) => {
    acc[`@angular/common/locales/${key}`] = {
      ...config,
      packageInfo: config.packageInfo || {
        ...config.packageInfo,
        entryPoint:
          config.packageInfo?.entryPoint ||
          `node_modules/@angular/common/locales/${key}.mjs`,
      },
    };
    return share(acc);
  }, {});
}
