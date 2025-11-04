export function normalize(path: string, trailingSlash?: boolean): string {
  let cand = path.replace(/\\/g, '/');

  if (typeof trailingSlash === 'undefined') {
    return cand;
  }

  while (cand.endsWith('/')) {
    cand = cand.substring(0, cand.length - 1);
  }

  if (trailingSlash) {
    return cand + '/';
  }

  return cand;
}

export function normalizeFilename(path: string) {
  let sanitized = path.replace(/[^A-Za-z0-9]/g, '_');
  return sanitized.startsWith('_') ? sanitized.slice(1) : sanitized;
}
