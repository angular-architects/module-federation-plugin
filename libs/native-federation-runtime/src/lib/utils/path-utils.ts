/**
 * Returns the full directory of a given path.
 * @param url - The path to get the directory of.
 * @returns The full directory of the path.
 */
export function getDirectory(url: string) {
  const parts = url.split('/');
  parts.pop();
  return parts.join('/');
}

/**
 * Joins two paths together taking into account trailing slashes and "./" prefixes.
 * @param path1 - The first path to join.
 * @param path2 - The second path to join.
 * @returns The joined path.
 */
export function joinPaths(path1: string, path2: string) {
  while (path1.endsWith('/')) {
    path1 = path1.substring(0, path1.length - 1);
  }
  if (path2.startsWith('./')) {
    path2 = path2.substring(2, path2.length);
  }

  return `${path1}/${path2}`;
}
