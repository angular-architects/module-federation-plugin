import * as crypto from 'crypto';

/**
 * Produces a content-addressed file name for a shared-package entry.
 *
 * `createOutName()` (see bundle-shared.ts) derives the entry file name from the package
 * *version* + entry path + config, not from its emitted bytes. Because the rewritten
 * `@nf-internal/chunk-*` imports point into a chunk graph shared across all shared
 * packages, an entry's content can change (an imported chunk is renamed) while its
 * version-based name stays the same — so caches serve a stale entry that imports a chunk
 * the current import map no longer lists ("Unable to resolve specifier
 * '@nf-internal/chunk-...'"). Hashing the final content makes the file name change if and
 * only if the content changes.
 *
 * Idempotent: a previously appended content hash is stripped before re-hashing, so
 * running this twice on the same bytes yields the same name.
 */
export function contentHashedName(
  outName: string,
  content: Buffer | string,
): string {
  const contentHash = crypto
    .createHash('md5')
    .update(content)
    .digest('hex')
    .substring(0, 12);
  const base = outName.replace(/\.js$/, '').replace(/\.[0-9a-f]{12}$/, '');
  return `${base}.${contentHash}.js`;
}
