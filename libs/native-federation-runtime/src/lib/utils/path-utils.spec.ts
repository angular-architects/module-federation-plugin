import { describe, expect, it } from 'vitest';
import { getDirectory, joinPaths } from './path-utils';

describe('getDirectory', () => {
  it('returns the directory for a simple path', () => {
    expect(getDirectory('/foo/baz.txt')).toBe('/foo');
  });

  it('returns the full path of the parents directory', () => {
    expect(getDirectory('/foo/anotherFoo/file.txt')).toBe('/foo/anotherFoo');
  });

  it('returns empty string for a path without a slash', () => {
    expect(getDirectory('file.txt')).toBe('');
  });
});

describe('joinPaths', () => {
  it('joins two normal paths', () => {
    expect(joinPaths('/foo/bar', 'baz.txt')).toBe('/foo/bar/baz.txt');
  });

  it('handles trailing slash in the first path', () => {
    expect(joinPaths('/foo/bar/', 'baz.txt')).toBe('/foo/bar/baz.txt');
  });

  it('handles multiple trailing slashes in the first path', () => {
    expect(joinPaths('/foo/bar///', 'baz.txt')).toBe('/foo/bar/baz.txt');
  });

  it('normalizes "./" in the second path', () => {
    expect(joinPaths('/foo/bar', './baz.txt')).toBe('/foo/bar/baz.txt');
  });

  it('combines empty first path', () => {
    expect(joinPaths('', 'baz.txt')).toBe('/baz.txt');
  });

  it('joins paths correctly if second path is just "./"', () => {
    expect(joinPaths('/foo/bar', './')).toBe('/foo/bar/');
  });
});
