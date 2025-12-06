import fg from 'fast-glob';

export type KeyValuePair = {
  key: string;
  value: string;
};

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Convert package.json exports pattern to glob pattern
// * in exports means "one segment", but for glob we need **/* for deep matching
// Src: https://hirok.io/posts/package-json-exports#exposing-all-package-files
function convertExportsToGlob(pattern: string) {
  return pattern.replace(/(?<!\*)\*(?!\*)/g, '**/*');
}

function compilePattern(pattern: string) {
  const tokens = pattern.split(/(\*\*|\*)/);
  const regexParts = [];

  for (const token of tokens) {
    if (token === '*') {
      regexParts.push('(.*)');
    } else {
      regexParts.push(escapeRegex(token));
    }
  }

  return new RegExp(`^${regexParts.join('')}$`);
}

function withoutWildcard(template: string, wildcardValues: string[]) {
  const tokens = template.split(/(\*\*|\*)/);
  let result = '';
  let i = 0;
  for (const token of tokens) {
    if (token === '*') {
      result += wildcardValues[i++];
    } else {
      result += token;
    }
  }
  return result;
}

export function resolveWildcardKeys(
  keyPattern: string,
  valuePattern: string,
  cwd: string,
): KeyValuePair[] {
  const normalizedPattern = valuePattern.replace(/^\.?\/+/, '');

  const globPattern = convertExportsToGlob(normalizedPattern);

  const regex = compilePattern(normalizedPattern);

  const files = fg.sync(globPattern, {
    cwd,
    onlyFiles: true,
    deep: Infinity,
  });

  const keys: KeyValuePair[] = [];

  for (const file of files) {
    const relPath = file.replace(/\\/g, '/').replace(/^\.\//, '');

    const wildcards = relPath.match(regex);
    if (!wildcards) continue;

    keys.push({
      key: withoutWildcard(keyPattern, wildcards.slice(1)),
      value: relPath,
    });
  }

  return keys;
}
