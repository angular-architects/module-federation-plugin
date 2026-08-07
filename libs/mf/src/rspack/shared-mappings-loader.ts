import * as path from 'path';

export type SharedLib = {
  key: string;
  libFolder: string;
};

export type SharedMappingsLoaderOptions = {
  libs: SharedLib[];
};

type LoaderContext = {
  resourcePath: string;
  getOptions(): SharedMappingsLoaderOptions;
  callback(
    err: Error | null,
    content?: string,
    sourceMap?: unknown,
    meta?: unknown,
  ): void;
};

// `from '…'`, `import '…'`, `import('…')` and `require('…')` with a relative
// specifier. Alternation order matters: `import(` has to be tried before the
// bare `import`.
const RELATIVE_SPECIFIER =
  /(\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)(['"])(\.\.?\/[^'"\n]*)\2/g;

//
// Angular's AOT output references a shared lib's *files* directly whenever it
// needs a symbol the author did not import by name — the declarations of an
// exported NgModule, for instance. Those requests are deep and relative, so
// Module Federation never sees the shared key and the lib gets bundled a
// second time next to its consume-shared copy: two classes, two DI tokens.
//
// The webpack helper rewrites such requests with a
// `NormalModuleReplacementPlugin`. That does not work here: rspack's
// consume-shared matching runs against the request the dependency was created
// with, so a `beforeResolve` rewrite lands too late — the request resolves to
// the lib but stays a plain module. Rewriting the source before rspack parses
// it (this is a post loader, so it sees the Angular transform's output) means
// the dependency is created with the shared key to begin with.
//
export default function sharedMappingsLoader(
  this: LoaderContext,
  source: string,
  sourceMap?: unknown,
  meta?: unknown,
): void {
  const { libs } = this.getOptions();
  const dir = path.dirname(this.resourcePath);

  if (libs.length === 0 || !source.includes('./')) {
    this.callback(null, source, sourceMap, meta);
    return;
  }

  const result = source.replace(
    RELATIVE_SPECIFIER,
    (match, head: string, quote: string, specifier: string) => {
      const target = path.normalize(path.join(dir, specifier));
      const lib = libs.find(
        (l) => !dir.startsWith(l.libFolder) && target.startsWith(l.libFolder),
      );
      return lib ? `${head}${quote}${lib.key}${quote}` : match;
    },
  );

  this.callback(null, result, sourceMap, meta);
}
