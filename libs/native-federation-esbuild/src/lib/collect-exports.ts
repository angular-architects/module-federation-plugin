import * as fs from 'fs';
import { parse } from 'acorn';

type Node = any;

type visitFn = (node: Node) => void;

export function collectExports(path: string) {
  const src = fs.readFileSync(path, 'utf8');

  const parseTree = parse(src, {
    ecmaVersion: 'latest',
    allowHashBang: true,
    sourceType: 'module',
  });

  let hasDefaultExport = false;
  let hasFurtherExports = false;
  let defaultExportName = '';
  const exports = new Set<string>();

  traverse(parseTree, (node) => {
    if (
      node.type === 'AssignmentExpression' &&
      node?.left?.object?.name === 'exports' // &&
    ) {
      exports.add(node.left.property?.name);
      return;
    }

    if (hasDefaultExport && hasFurtherExports) {
      return;
    }

    if (node.type !== 'ExportNamedDeclaration') {
      return;
    }

    if (!node.specifiers) {
      hasFurtherExports = true;
      return;
    }

    for (const s of node.specifiers) {
      if (isDefaultExport(s)) {
        defaultExportName = s?.local?.name;
        hasDefaultExport = true;
      } else {
        hasFurtherExports = true;
      }
    }
  });

  return {
    hasDefaultExport,
    hasFurtherExports,
    defaultExportName,
    exports: [...exports],
  };
}

function traverse(node: Node, visit: visitFn) {
  visit(node);
  for (const key in node) {
    const prop = node[key];
    if (prop && typeof prop === 'object') {
      traverse(prop as Node, visit);
    } else if (Array.isArray(prop)) {
      for (const sub of prop) {
        traverse(sub, visit);
      }
    }
  }
}

function isDefaultExport(exportSpecifier: Node) {
  return (
    exportSpecifier.exported?.type === 'Identifier' &&
    exportSpecifier.exported?.name === 'default'
  );
}
