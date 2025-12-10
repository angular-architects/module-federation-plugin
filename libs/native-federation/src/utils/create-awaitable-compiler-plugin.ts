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
      let onDisposeCallback: (() => void | Promise<void>) | undefined;

      // Wrap the build object to intercept onDispose
      const wrappedBuild = new Proxy(build, {
        get(target, prop) {
          if (prop === 'onDispose') {
            return (callback: () => void | Promise<void>) => {
              onDisposeCallback = callback;
              return target.onDispose(async () => {
                await callback();
                resolveDispose();
              });
            };
          }
          return target[prop as keyof esbuild.PluginBuild];
        },
      });

      // Call original setup with wrapped build
      return originalPlugin.setup(wrappedBuild);
    },
  };

  return [wrappedPlugin, onDisposePromise];
}
