const PLUGIN_NAME = 'modify-entry-plugin';
export class ModifyEntryPlugin {
  config: unknown;
  constructor(config) {
    this.config = config;
  }

  apply(compiler) {
    compiler.hooks.afterEnvironment.tap(PLUGIN_NAME, () => {
      const webpackOptions = compiler.options;
      const entry =
        typeof webpackOptions.entry === 'function'
          ? webpackOptions.entry()
          : webpackOptions.entry;

      webpackOptions.entry = async () => {
        const entries = await entry;

        const mergeEntry = (keyFn, key) => [
          ...(keyFn(this.config[key]) || []),
          ...(keyFn(entries[key]) || []),
        ];
        const cfgOrRemove = (objFn, valueFn, key) => {
          const values = mergeEntry(valueFn, key);
          return values.length > 0 ? objFn(values) : {};
        };

        Object.keys(this.config).forEach((key) => {
          entries[key] = {
            ...cfgOrRemove(
              (v) => ({ import: v }),
              (c) => c.import,
              key
            ),
            ...cfgOrRemove(
              (v) => ({ dependOn: v }),
              (c) => c.dependOn,
              key
            ),
          };
        });

        return entries;
      };
    });
  }
}
