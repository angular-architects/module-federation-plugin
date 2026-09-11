import * as fs from 'fs';
import { initSync, parse } from 'es-module-lexer';
import {
  decode,
  encode,
  type SourceMapMappings,
} from '@jridgewell/sourcemap-codec';

export const INTERNAL_SCOPE = '@nf-internal';

interface SpecifierEdit {
  start: number;
  end: number;
  text: string;
}

function collectSpecifierEdits(
  sourceCode: string,
  filePath: string,
): SpecifierEdit[] {
  initSync();
  const [imports] = parse(sourceCode, filePath);
  const edits: SpecifierEdit[] = [];
  for (const imp of imports) {
    if (imp.d === -2 || imp.n === undefined || !imp.n.startsWith('./')) {
      continue; // import.meta, non-literal dynamic argument, or not a chunk ref
    }
    let start = imp.s;
    let end = imp.e;
    if (imp.d > -1) {
      // dynamic import: s/e include the quotes — step inside them
      const quote = sourceCode[start];
      if (quote !== '"' && quote !== "'") {
        continue;
      }
      start += 1;
      end -= 1;
    }
    edits.push({ start, end, text: deriveInternalName(imp.n) });
  }
  return edits.sort((a, b) => a.start - b.start);
}

export function rewriteChunkImports(filePath: string) {
  const sourceCode = fs.readFileSync(filePath, 'utf-8');
  const edits = collectSpecifierEdits(sourceCode, filePath);
  if (edits.length === 0) {
    return;
  }

  let result = '';
  let last = 0;
  for (const e of edits) {
    result += sourceCode.slice(last, e.start) + e.text;
    last = e.end;
  }
  result += sourceCode.slice(last);
  fs.writeFileSync(filePath, result, 'utf-8');

  const mapFile = `${filePath}.map`;
  if (fs.existsSync(mapFile)) {
    const map = JSON.parse(fs.readFileSync(mapFile, 'utf-8'));
    if (map.mappings) {
      map.mappings = shiftMappings(map.mappings, sourceCode, edits);
      fs.writeFileSync(mapFile, JSON.stringify(map), 'utf-8');
    }
  }
}

function shiftMappings(
  mappings: string,
  code: string,
  edits: SpecifierEdit[],
): string {
  const lineStarts = [0];
  for (let i = 0; i < code.length; i++) {
    if (code.charCodeAt(i) === 10) {
      lineStarts.push(i + 1);
    }
  }
  let line = 0;
  const byLine = new Map<
    number,
    { start: number; end: number; delta: number }[]
  >();
  for (const e of edits) {
    while (line + 1 < lineStarts.length && lineStarts[line + 1] <= e.start) {
      line++;
    }
    const col = e.start - lineStarts[line];
    const list = byLine.get(line) ?? [];
    list.push({
      start: col,
      end: e.end - lineStarts[line],
      delta: e.text.length - (e.end - e.start),
    });
    byLine.set(line, list);
  }

  const decoded: SourceMapMappings = decode(mappings);
  for (const [editLine, list] of byLine) {
    for (const segment of decoded[editLine] ?? []) {
      let shift = 0;
      for (const e of list) {
        if (e.end <= segment[0]) {
          shift += e.delta;
        } else if (e.start < segment[0]) {
          // starts inside the replaced span: clamp to its start (defensive —
          // real bundles never map into the middle of a specifier literal)
          shift += e.start - segment[0];
        }
      }
      segment[0] += shift;
    }
  }
  return encode(decoded);
}

export function isSourceFile(fileName: string): boolean {
  return !!fileName.match(/.(m|c)?js$/);
}

/** './chunk-X.js' -> '@nf-internal/chunk-X' */
export function deriveInternalName(fileName: string): string {
  if (fileName.startsWith('./')) {
    fileName = fileName.slice(2);
  }
  const packageName = fileName.replace(/.(m|c)?js$/, '');
  return INTERNAL_SCOPE + '/' + packageName;
}
