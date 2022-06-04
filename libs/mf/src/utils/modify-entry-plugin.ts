export class ModifyEntryPlugin {
  config: unknown;
  constructor(config) {
    this.config = config;
  }

  apply(compiler) {
    const mergeEntry = (keyFn, key) => [
      ...(keyFn(this.config[key]) || []),
      ...(keyFn(compiler.options.entry[key]) || []),
    ];
    const cfgOrRemove = (objFn, valueFn, key) => {
      const values = mergeEntry(valueFn, key);
      return values.length > 0 ? objFn(values) : {};
    };
    Object.keys(this.config).forEach((key) => {
      compiler.options.entry[key] = {
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
  }
}

