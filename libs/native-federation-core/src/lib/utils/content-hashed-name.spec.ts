import { contentHashedName } from './content-hashed-name';

describe('contentHashedName', () => {
  const entry = '_acme_ui_core_utils.WBGsfdhQ1R.js';

  it('appends a content hash and keeps the original base name', () => {
    const name = contentHashedName(
      entry,
      'import "@nf-internal/chunk-BL4UGAOX";',
    );
    expect(name).toMatch(
      /^_acme_ui_core_utils\.WBGsfdhQ1R\.[0-9a-f]{12}\.js$/,
    );
  });

  it('is stable for identical content', () => {
    const content = 'import "@nf-internal/chunk-BL4UGAOX";';
    expect(contentHashedName(entry, content)).toBe(
      contentHashedName(entry, content),
    );
  });

  it('changes when the content changes (the bug this fixes)', () => {
    // Same version-based entry name, but an imported chunk was renamed -> different bytes.
    const before = contentHashedName(
      entry,
      'import "@nf-internal/chunk-BL4UGAOX";',
    );
    const after = contentHashedName(
      entry,
      'import "@nf-internal/chunk-I76J64FX";',
    );
    expect(after).not.toBe(before);
  });

  it('is idempotent (re-hashing strips a previously applied content hash)', () => {
    const content = 'export const x = 1;';
    const once = contentHashedName(entry, content);
    const twice = contentHashedName(once, content);
    expect(twice).toBe(once);
  });

  it('accepts Buffer content', () => {
    const buf = Buffer.from('export const x = 1;');
    expect(contentHashedName(entry, buf)).toBe(
      contentHashedName(entry, 'export const x = 1;'),
    );
  });
});
