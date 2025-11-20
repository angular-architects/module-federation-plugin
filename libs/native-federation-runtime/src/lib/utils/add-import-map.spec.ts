import { describe, expect, it } from 'vitest';
import { appendImportMap } from './add-import-map';

describe('appendImportMap', () => {
  it('appends a script tag with importmap-shim type and innerHTML', () => {
    const fakeImportMap = {
      imports: {
        foo: '/bar/baz.js',
      },
      scopes: {},
    };

    // Execute
    appendImportMap(fakeImportMap);

    // Assert - check that a new script element was added
    const scriptElements = document.head.querySelectorAll(
      'script[type="importmap-shim"]'
    );
    expect(scriptElements).toHaveLength(1);

    // Get the last added script element
    const addedScript = scriptElements[
      scriptElements.length - 1
    ] as HTMLScriptElement;
    expect(addedScript.type).toBe('importmap-shim');
    expect(addedScript.innerHTML).toBe(JSON.stringify(fakeImportMap));

    // Cleanup
    document.head.removeChild(addedScript);
  });
});
