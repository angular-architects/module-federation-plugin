// Taken from https://github.com/angular/angular-cli/blob/main/packages/angular/build/src/tools/esbuild/compiler-plugin-options.ts
// Currently, this type cannot be accessed from the outside

export function createCompilerPluginOptions(
  options: any,
  target: string[],
  sourceFileCache?: any,
): {
  pluginOptions: any[0];
  styleOptions: any[1];
} {
  const {
    workspaceRoot,
    optimizationOptions,
    sourcemapOptions,
    tsconfig,
    outputNames,
    fileReplacements,
    externalDependencies,
    preserveSymlinks,
    stylePreprocessorOptions,
    advancedOptimizations,
    inlineStyleLanguage,
    jit,
    cacheOptions,
    tailwindConfiguration,
    postcssConfiguration,
    publicPath,
  } = options;

  return {
    // JS/TS options
    pluginOptions: {
      sourcemap:
        !!sourcemapOptions.scripts &&
        (sourcemapOptions.hidden ? 'external' : true),
      thirdPartySourcemaps: sourcemapOptions.vendor,
      tsconfig,
      jit,
      advancedOptimizations,
      fileReplacements,
      sourceFileCache,
      loadResultCache: sourceFileCache?.loadResultCache,
      incremental: !!options.watch,
    },
    // Component stylesheet options
    styleOptions: {
      workspaceRoot,
      inlineFonts: !!optimizationOptions.fonts.inline,
      optimization: !!optimizationOptions.styles.minify,
      sourcemap:
        // Hidden component stylesheet sourcemaps are inaccessible which is effectively
        // the same as being disabled. Disabling has the advantage of avoiding the overhead
        // of sourcemap processing.
        sourcemapOptions.styles && !sourcemapOptions.hidden ? 'linked' : false,
      outputNames,
      includePaths: stylePreprocessorOptions?.includePaths,
      sass: stylePreprocessorOptions?.sass,
      externalDependencies,
      target,
      inlineStyleLanguage,
      preserveSymlinks,
      tailwindConfiguration,
      postcssConfiguration,
      cacheOptions,
      publicPath,
    },
  };
}
