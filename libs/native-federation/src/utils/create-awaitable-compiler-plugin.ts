import * as esbuild from 'esbuild';
import { createCompilerPlugin } from '@angular/build/private';

type CreateCompilerPluginParams = Parameters<typeof createCompilerPlugin>;

let plugin: esbuild.Plugin | undefined = undefined;
let pluginPromise: Promise<void> = new Promise(() => {});

export function createAwaitableCompilerPlugin(
  pluginOptions: CreateCompilerPluginParams[0],
  styleOptions: CreateCompilerPluginParams[1],
): [esbuild.Plugin, Promise<void>] {
  if (!!plugin) {
    const originalPlugin = createCompilerPlugin(pluginOptions, styleOptions);

    let resolveDispose: () => void;
    pluginPromise = new Promise<void>((resolve) => {
      resolveDispose = resolve;
    });

    plugin = {
      ...originalPlugin,
      setup(build: esbuild.PluginBuild) {
        // Wrap the build object to intercept onDispose
        const wrappedBuild = new Proxy(build, {
          get(target, prop) {
            if (prop === 'onDispose') {
              return (callback: () => void | Promise<void>) => {
                return target.onDispose(() => {
                  callback();
                  resolveDispose();
                });
              };
            }
            return target[prop as keyof esbuild.PluginBuild];
          },
        });

        return originalPlugin.setup(wrappedBuild);
      },
    };
  }

  return [plugin, pluginPromise];
}
