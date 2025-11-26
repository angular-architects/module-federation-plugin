import fg from 'fast-glob';

export type KeyValuePair = {
  key: string;
  value: string;
};

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compilePattern(pattern: string) {
  const tokens = pattern.split(/(\*\*|\*)/);
  const regexParts = [];

  for (const token of tokens) {
    if (token === '*') {
      regexParts.push('([^/]+)');
    } else if (token === '**') {
      regexParts.push('(.*)');
    } else {
      regexParts.push(escapeRegex(token));
    }
  }

  return new RegExp(`^${regexParts.join('')}$`);
}

function applyWildcards(template: string, wildcardValues: string[]) {
  const tokens = template.split(/(\*\*|\*)/);
  let result = '';
  let i = 0;
  for (const token of tokens) {
    if (token === '*' || token === '**') {
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
  const regex = compilePattern(normalizedPattern);

  const files = fg.sync(valuePattern, {
    cwd,
    onlyFiles: true,
  });

  const keys: KeyValuePair[] = [];

  for (const file of files) {
    const relPath = file.replace(/\\/g, '/').replace(/^\.\//, '');

    const match = relPath.match(regex);
    if (!match) {
      continue;
    }

    const wildcards = match.slice(1);
    const key = applyWildcards(keyPattern, wildcards);

    // Change this:
    keys.push({ key, value: relPath });
  }

  return keys;
}
