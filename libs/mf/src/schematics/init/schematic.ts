import { chain, Rule, schematic, noop } from '@angular-devkit/schematics';

import {
  NodePackageInstallTask,
  RunSchematicTask,
} from '@angular-devkit/schematics/tasks';

import { InitSchema } from './schema';

type DelegationOptions = Omit<InitSchema, 'stack'>;

export function init(options: InitSchema): Rule {
  return async function (tree, context) {
    options = normalizeOptions(options);

    const { stack, ...delegationOptions } = options;

    switch (stack) {
      case 'module-federation-webpack':
        return chain([schematic('init-webpack', delegationOptions)]);

      case 'module-federation-rsbuild-experimental':
        return chain([schematic('init-rspack', delegationOptions)]);

      case 'native-federation-esbuild':
        initNativeFederation(context, delegationOptions);
    }
    return noop();
  };
}

function initNativeFederation(context, delegationOptions: DelegationOptions) {
  context.addTask(
    new RunSchematicTask(
      '@angular-architects/native-federation',
      'init',
      delegationOptions
    ),
    [
      context.addTask(
        new NodePackageInstallTask({
          packageName: '@angular-architects/native-federation@^19.0.0',
        })
      ),
    ]
  );
}

function normalizeOptions(options: InitSchema): InitSchema {
  return {
    ...options,
    port: options.port || 4200,
  };
}
