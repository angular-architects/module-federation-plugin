import * as path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';

export function getExternalImports(entryFilePath: string) {
  const visited = new Set<string>();
  const externals = new Set<string>();

  function isExternal(specifier: string) {
    return !specifier.startsWith('.') && !path.isAbsolute(specifier);
  }

  function normalizeExternal(specifier: string) {
    return specifier;
  }

  function resolveAsFileOrDirectory(p: string) {
    const abs = path.resolve(p);

    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;

    const extensions = ['.ts', '.js', '.mjs', '.cjs'];
    for (const ext of extensions) {
      if (fs.existsSync(abs + ext) && fs.statSync(abs + ext).isFile()) {
        return abs + ext;
      }
    }

    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      for (const file of extensions.map((e) => 'index' + e)) {
        const indexPath = path.join(abs, file);
        if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
          return indexPath;
        }
      }
    }

    return null;
  }

  function visit(filePath: string) {
    const absPath = path.resolve(filePath);
    if (visited.has(absPath)) return;
    visited.add(absPath);

    const resolved = resolveAsFileOrDirectory(absPath);
    if (!resolved) return;

    const source = fs.readFileSync(resolved, 'utf8');
    const sourceFile = ts.createSourceFile(
      resolved,
      source,
      ts.ScriptTarget.Latest,
      true
    );

    function walk(node: ts.Node) {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (moduleSpecifier && ts.isStringLiteral(moduleSpecifier)) {
          const spec = moduleSpecifier.text;
          if (isExternal(spec)) {
            externals.add(normalizeExternal(spec));
          } else {
            const resolvedPath = resolveAsFileOrDirectory(
              path.resolve(path.dirname(resolved ?? ''), spec)
            );
            if (resolvedPath) visit(resolvedPath);
          }
        }
      }

      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.kind === ts.SyntaxKind.Identifier &&
        node.expression.escapedText === 'require' &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const spec = node.arguments[0].text;
        if (isExternal(spec)) {
          externals.add(normalizeExternal(spec));
        } else {
          const resolvedPath = resolveAsFileOrDirectory(
            path.resolve(path.dirname(resolved ?? ''), spec)
          );
          if (resolvedPath) visit(resolvedPath);
        }
      }

      ts.forEachChild(node, walk);
    }

    ts.forEachChild(sourceFile, walk);
  }

  visit(entryFilePath);

  return Array.from(externals);
}
