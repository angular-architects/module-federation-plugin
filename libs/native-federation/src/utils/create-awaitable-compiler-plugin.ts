import * as esbuild from 'esbuild';
import { createCompilerPlugin } from '@angular/build/private';

export function createAwaitableCompilerPlugin(
  pluginOptions: any,
  styleOptions: any,
): [esbuild.Plugin, Promise<void>] {
  const originalPlugin = createCompilerPlugin(pluginOptions, styleOptions);

  let resolveDispose: () => void;
  const onDisposePromise = new Promise<void>((resolve) => {
    resolveDispose = resolve;
  });

  const wrappedPlugin: esbuild.Plugin = {
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

  return [wrappedPlugin, onDisposePromise];
}
