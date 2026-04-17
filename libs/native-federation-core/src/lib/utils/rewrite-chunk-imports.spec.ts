import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  deriveInternalName,
  INTERNAL_SCOPE,
  isSourceFile,
  rewriteChunkImports,
} from './rewrite-chunk-imports';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeTempFile(name: string, content: string): string {
  const filePath = path.join(os.tmpdir(), name);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

function readTempFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

function removeTempFile(filePath: string): void {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// ---------------------------------------------------------------------------
// deriveInternalName
// ---------------------------------------------------------------------------

describe('deriveInternalName', () => {
  it('converts a relative .js import to an @nf-internal bare specifier', () => {
    expect(deriveInternalName('./chunk-ABC.js')).toBe(
      `${INTERNAL_SCOPE}/chunk-ABC`,
    );
  });

  it('converts a relative .mjs import', () => {
    expect(deriveInternalName('./chunk-XYZ.mjs')).toBe(
      `${INTERNAL_SCOPE}/chunk-XYZ`,
    );
  });

  it('converts a relative .cjs import', () => {
    expect(deriveInternalName('./chunk-CJS.cjs')).toBe(
      `${INTERNAL_SCOPE}/chunk-CJS`,
    );
  });

  it('handles a name without a leading ./', () => {
    expect(deriveInternalName('chunk-NO-PREFIX.js')).toBe(
      `${INTERNAL_SCOPE}/chunk-NO-PREFIX`,
    );
  });
});

// ---------------------------------------------------------------------------
// isSourceFile
// ---------------------------------------------------------------------------

describe('isSourceFile', () => {
  it('returns true for .js files', () => {
    expect(isSourceFile('bundle.js')).toBe(true);
  });

  it('returns true for .mjs files', () => {
    expect(isSourceFile('bundle.mjs')).toBe(true);
  });

  it('returns true for .cjs files', () => {
    expect(isSourceFile('bundle.cjs')).toBe(true);
  });

  it('returns false for .ts files', () => {
    expect(isSourceFile('bundle.ts')).toBe(false);
  });

  it('returns false for .json files', () => {
    expect(isSourceFile('metadata.json')).toBe(false);
  });

  it('returns false for .map files', () => {
    expect(isSourceFile('bundle.js.map')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// rewriteChunkImports — normal rewriting
// ---------------------------------------------------------------------------

describe('rewriteChunkImports — normal files', () => {
  let tmpFile: string;

  afterEach(() => removeTempFile(tmpFile));

  it('rewrites a static import from a relative path to @nf-internal', () => {
    tmpFile = writeTempFile(
      'shared-bundle.ABC123.js',
      `import { foo } from "./chunk-ABC123.js";\nexport { foo };\n`,
    );

    rewriteChunkImports(tmpFile);

    expect(readTempFile(tmpFile)).toContain(
      `"${INTERNAL_SCOPE}/chunk-ABC123"`,
    );
    expect(readTempFile(tmpFile)).not.toContain('./chunk-ABC123.js');
  });

  it('rewrites a re-export from a relative path to @nf-internal', () => {
    tmpFile = writeTempFile(
      'shared-bundle.DEF456.js',
      `export { bar } from "./chunk-DEF456.js";\n`,
    );

    rewriteChunkImports(tmpFile);

    expect(readTempFile(tmpFile)).toContain(
      `"${INTERNAL_SCOPE}/chunk-DEF456"`,
    );
    expect(readTempFile(tmpFile)).not.toContain('./chunk-DEF456.js');
  });

  it('rewrites a dynamic import from a relative path to @nf-internal', () => {
    tmpFile = writeTempFile(
      'shared-bundle.GHI789.js',
      `const m = import("./chunk-GHI789.js");\n`,
    );

    rewriteChunkImports(tmpFile);

    expect(readTempFile(tmpFile)).toContain(
      `"${INTERNAL_SCOPE}/chunk-GHI789"`,
    );
    expect(readTempFile(tmpFile)).not.toContain('./chunk-GHI789.js');
  });

  it('does not rewrite absolute or bare specifier imports', () => {
    const original = `import { x } from "@angular/core";\nimport { y } from "/absolute.js";\n`;
    tmpFile = writeTempFile('shared-bundle.JKL.js', original);

    rewriteChunkImports(tmpFile);

    const result = readTempFile(tmpFile);
    expect(result).toContain('@angular/core');
    expect(result).toContain('/absolute.js');
  });
});

// ---------------------------------------------------------------------------
// rewriteChunkImports — _angular_compiler guard
// ---------------------------------------------------------------------------

describe('rewriteChunkImports — _angular_compiler files', () => {
  it('does NOT rewrite imports when the file name contains _angular_compiler', () => {
    // This guard is critical: _angular_compiler artifacts are loaded via native
    // import() when the host sets esmsInitOptions.skip to bypass es-module-shims
    // for large files. Native import() cannot resolve @nf-internal/* bare
    // specifiers, so their chunk imports must stay as relative paths.
    const original = `import { __spreadValues } from "./chunk-WO6WBJ4Z.js";\n`;
    const tmpFile = writeTempFile(
      '_angular_compiler.WM-0EiHxmR-dev.js',
      original,
    );

    rewriteChunkImports(tmpFile);

    expect(readTempFile(tmpFile)).toBe(original);
    removeTempFile(tmpFile);
  });

  it('does NOT rewrite when _angular_compiler appears anywhere in the basename', () => {
    const original = `export * from "./chunk-ABC.js";\n`;
    const tmpFile = writeTempFile(
      'prefix_angular_compiler_suffix.hash.js',
      original,
    );

    rewriteChunkImports(tmpFile);

    expect(readTempFile(tmpFile)).toBe(original);
    removeTempFile(tmpFile);
  });

  it('DOES rewrite files whose name only contains "angular" but not "_angular_compiler"', () => {
    const original = `import { x } from "./chunk-XXYYZZ.js";\n`;
    const tmpFile = writeTempFile('angular-forms.hash.js', original);

    rewriteChunkImports(tmpFile);

    expect(readTempFile(tmpFile)).toContain(`${INTERNAL_SCOPE}/chunk-XXYYZZ`);
    removeTempFile(tmpFile);
  });
});
