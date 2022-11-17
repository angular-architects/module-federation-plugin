export function getDirectory(url: string) {
  const parts = url.split('/');
  parts.pop();
  return parts.join('/');
}

export function joinPaths(path1: string, path2: string): string {
  while (path1.endsWith('/')) {
    path1 = path1.substring(0, path1.length - 1);
  }
  if (path2.startsWith('./')) {
    path2 = path2.substring(2, path2.length);
  }

  return `${path1}/${path2}`;
}
