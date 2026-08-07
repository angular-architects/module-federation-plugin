import { chain, Rule, schematic, noop } from '@angular-devkit/schematics';

import { InitSchema } from './schema';

export function init(options: InitSchema): Rule {
  return async function () {
    options = normalizeOptions(options);

    const { stack, ...delegationOptions } = options;

    switch (stack) {
      case 'module-federation-webpack':
        return chain([schematic('init-webpack', delegationOptions)]);

      case 'module-federation-rsbuild-experimental':
        return chain([schematic('init-rspack', delegationOptions)]);
    }
    return noop();
  };
}

function normalizeOptions(options: InitSchema): InitSchema {
  return {
    ...options,
    port: options.port || 4200,
  };
}
