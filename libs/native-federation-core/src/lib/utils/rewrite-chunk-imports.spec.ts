import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { decode, encode } from '@jridgewell/sourcemap-codec';
import type { SourceMapMappings } from '@jridgewell/sourcemap-codec';
import {
  rewriteChunkImports,
  deriveInternalName,
  isSourceFile,
  INTERNAL_SCOPE,
} from './rewrite-chunk-imports';

describe('rewriteChunkImports', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-rewrite-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function writeBundle(
    name: string,
    code: string,
    mappings?: SourceMapMappings,
  ): string {
    const file = path.join(dir, name);
    fs.writeFileSync(file, code, 'utf-8');
    if (mappings) {
      fs.writeFileSync(
        `${file}.map`,
        JSON.stringify({
          version: 3,
          file: name,
          sourceRoot: 'webpack://app/',
          sources: ['src/a.ts', 'src/b.ts'],
          sourcesContent: ['let a = 1;\n', 'let b = 2;\n'],
          names: ['alpha', 'beta'],
          mappings: encode(mappings),
        }),
        'utf-8',
      );
    }
    return file;
  }

  const readMap = (file: string) =>
    JSON.parse(fs.readFileSync(`${file}.map`, 'utf-8'));

  it('should rewrite static imports, re-exports and dynamic imports to the internal scope', () => {
    const code =
      `import{a}from"./chunk-A.js";` +
      `export{b}from"./chunk-B.js";` +
      `const p=import("./chunk-C.js");`;
    const file = writeBundle('all-forms.js', code);

    rewriteChunkImports(file);

    const out = fs.readFileSync(file, 'utf-8');
    expect(out).toContain(`import{a}from"${INTERNAL_SCOPE}/chunk-A"`);
    expect(out).toContain(`export{b}from"${INTERNAL_SCOPE}/chunk-B"`);
    expect(out).toContain(`import("${INTERNAL_SCOPE}/chunk-C")`);
    expect(out).not.toContain('./chunk-');
  });

  it('should leave bare specifiers, non-literal dynamic imports and plain strings untouched', () => {
    const code =
      `import{x}from"@angular/core";` +
      `const q=import(base+"/late.js");` +
      `const decoy="./chunk-D.js";`;
    const file = writeBundle('untouchable.js', code);
    const before = fs.statSync(file).mtimeMs;

    rewriteChunkImports(file);

    // nothing rewritable -> the file is not even written
    expect(fs.readFileSync(file, 'utf-8')).toBe(code);
    expect(fs.statSync(file).mtimeMs).toBe(before);
  });

  it('should not touch the map of a file without chunk imports', () => {
    const code = `import{x}from"@angular/core";console.log(x);`;
    const file = writeBundle('no-chunks.js', code, [
      [
        [0, 0, 0, 0],
        [10, 0, 0, 4, 0],
      ],
    ]);
    const mapBefore = fs.readFileSync(`${file}.map`, 'utf-8');

    rewriteChunkImports(file);

    expect(fs.readFileSync(`${file}.map`, 'utf-8')).toBe(mapBefore);
  });

  it('should shift only generated columns, accumulating deltas across edits on one line', () => {
    // './chunk-A.js' (12 chars) -> '@nf-internal/chunk-A' (20 chars): +8 per edit
    const code = `import{a}from"./chunk-A.js";import{b}from"./chunk-B.js";fn(a,b);`;
    // segments: before both edits, between them, after both — plus a named one
    const file = writeBundle('shift.js', code, [
      [
        [0, 0, 0, 0], // col 0: before edits
        [30, 0, 0, 4, 0], // col 30: after edit 1 (+8)
        [58, 1, 0, 0, 1], // col 58: after both edits (+16)
      ],
    ]);

    rewriteChunkImports(file);

    const map = readMap(file);
    const decoded = decode(map.mappings);
    expect(decoded).toEqual([
      [
        [0, 0, 0, 0],
        [38, 0, 0, 4, 0],
        [74, 1, 0, 0, 1],
      ],
    ]);
  });

  it('should preserve every map field except mappings byte-for-byte', () => {
    const code = `import{a}from"./chunk-A.js";fn(a);`;
    const file = writeBundle('fields.js', code, [
      [
        [0, 0, 0, 0],
        [29, 1, 0, 0, 1],
      ],
    ]);
    const before = readMap(file);

    rewriteChunkImports(file);

    const after = readMap(file);
    expect(after.names).toEqual(before.names);
    expect(after.sources).toEqual(before.sources);
    expect(after.sourcesContent).toEqual(before.sourcesContent);
    // sourceRoot must come through un-resolved and un-duplicated
    expect(after.sourceRoot).toBe('webpack://app/');
    // segment count and every non-column field identical
    const a = decode(before.mappings);
    const b = decode(after.mappings);
    expect(b.length).toBe(a.length);
    for (let line = 0; line < a.length; line++) {
      expect(b[line].length).toBe(a[line].length);
      for (let i = 0; i < a[line].length; i++) {
        expect(b[line][i].length).toBe(a[line][i].length);
        expect(b[line][i].slice(1)).toEqual(a[line][i].slice(1));
      }
    }
  });

  it('should shift lines independently in multi-line files', () => {
    const code = `import{a}from"./chunk-A.js";\nimport{b}from"./chunk-B.js";\nfn(a,b);`;
    const file = writeBundle('lines.js', code, [
      [
        [0, 0, 0, 0],
        [28, 0, 0, 4],
      ],
      [
        [0, 1, 0, 0],
        [28, 1, 0, 4],
      ],
      [[0, 0, 1, 0]],
    ]);

    rewriteChunkImports(file);

    const decoded = decode(readMap(file).mappings);
    // trailing segment on each edited line shifts by +8; line 3 untouched
    expect(decoded[0]).toEqual([
      [0, 0, 0, 0],
      [36, 0, 0, 4],
    ]);
    expect(decoded[1]).toEqual([
      [0, 1, 0, 0],
      [36, 1, 0, 4],
    ]);
    expect(decoded[2]).toEqual([[0, 0, 1, 0]]);
  });

  it('should derive the rename from the cooked specifier while splicing the raw range', () => {
    // c is 'c': cooked name is './chunk-E.js', raw text is longer
    const code = `import e from"./\\u0063hunk-E.js";use(e);`;
    const file = writeBundle('escaped.js', code);

    rewriteChunkImports(file);

    const out = fs.readFileSync(file, 'utf-8');
    expect(out).toContain(`from"${INTERNAL_SCOPE}/chunk-E"`);
    expect(out).not.toContain('u0063');
  });

  it('should rewrite the code even when no map file exists', () => {
    const file = writeBundle('mapless.js', `import{a}from"./chunk-A.js";`);

    expect(() => rewriteChunkImports(file)).not.toThrow();
    expect(fs.readFileSync(file, 'utf-8')).toContain(
      `${INTERNAL_SCOPE}/chunk-A`,
    );
    expect(fs.existsSync(`${file}.map`)).toBe(false);
  });
});

describe('deriveInternalName', () => {
  it('should map chunk file names into the internal scope without extension', () => {
    expect(deriveInternalName('./chunk-X.js')).toBe(
      `${INTERNAL_SCOPE}/chunk-X`,
    );
    expect(deriveInternalName('./chunk-Y.mjs')).toBe(
      `${INTERNAL_SCOPE}/chunk-Y`,
    );
    expect(deriveInternalName('./chunk-Z.cjs')).toBe(
      `${INTERNAL_SCOPE}/chunk-Z`,
    );
    expect(deriveInternalName('plain.js')).toBe(`${INTERNAL_SCOPE}/plain`);
  });
});

describe('isSourceFile', () => {
  it('should accept js module files and reject others', () => {
    expect(isSourceFile('a.js')).toBe(true);
    expect(isSourceFile('a.mjs')).toBe(true);
    expect(isSourceFile('a.cjs')).toBe(true);
    expect(isSourceFile('a.css')).toBe(false);
    expect(isSourceFile('a.js.map')).toBe(false);
  });
});
