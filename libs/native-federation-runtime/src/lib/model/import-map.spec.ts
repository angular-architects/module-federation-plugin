import { describe, expect, it } from 'vitest';
import { mergeImportMaps, ImportMap } from './import-map';

describe('import-map', () => {
  const fakeImportMap1: ImportMap = {
    imports: {
      '@angular/core': 'http://localhost:4200/angular-core.js',
      lodash: 'http://localhost:4200/lodash.js',
    },
    scopes: {
      'http://localhost:4200/': {
        react: 'http://localhost:4200/react.js',
      },
    },
  };

  const fakeImportMap2: ImportMap = {
    imports: {
      '@angular/common': 'http://localhost:4201/angular-common.js',
      lodash: 'http://localhost:4201/lodash.js', // This should override the first one
    },
    scopes: {
      'http://localhost:4201/': {
        vue: 'http://localhost:4201/vue.js',
      },
    },
  };

  describe('mergeImportMaps', () => {
    it('merges two import maps correctly', () => {
      const result = mergeImportMaps(fakeImportMap1, fakeImportMap2);

      expect(result.imports['@angular/core']).toBe(
        'http://localhost:4200/angular-core.js',
      );
      expect(result.imports['@angular/common']).toBe(
        'http://localhost:4201/angular-common.js',
      );
      expect(result.imports['lodash']).toBe('http://localhost:4201/lodash.js'); // Second map wins
    });

    it('merges scopes from both maps', () => {
      const result = mergeImportMaps(fakeImportMap1, fakeImportMap2);

      expect(result.scopes['http://localhost:4200/']['react']).toBe(
        'http://localhost:4200/react.js',
      );
      expect(result.scopes['http://localhost:4201/']['vue']).toBe(
        'http://localhost:4201/vue.js',
      );
    });

    it('handles empty import maps', () => {
      const emptyMap: ImportMap = { imports: {}, scopes: {} };

      const result = mergeImportMaps(fakeImportMap1, emptyMap);

      expect(result).toEqual(fakeImportMap1);
    });
  });
});
