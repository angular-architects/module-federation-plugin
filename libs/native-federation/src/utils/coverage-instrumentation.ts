import { globSync } from 'node:fs';
import * as path from 'node:path';

import { type BuilderContext } from '@angular-devkit/architect';

// Mirrors @angular/build's src/builders/karma/coverage.ts. Copied rather than
// imported: those helpers aren't re-exported from @angular/build/private and sit
// on an unstable internal path.

export function createInstrumentationFilter(
  includedBasePath: string,
  excludedPaths: Set<string>,
): (request: string) => boolean {
  return (request: string): boolean =>
    !excludedPaths.has(request) &&
    !/\.(e2e|spec)\.tsx?$|[\\/]node_modules[\\/]|[\\/]\.angular[\\/]/.test(
      request,
    ) &&
    request.startsWith(includedBasePath);
}

export function getInstrumentationExcludedPaths(
  root: string,
  excludedPaths: string[],
): Set<string> {
  const excluded = new Set<string>();
  for (const excludeGlob of excludedPaths) {
    const excludePath =
      excludeGlob[0] === '/' ? excludeGlob.slice(1) : excludeGlob;
    for (const p of globSync(excludePath, { cwd: root })) {
      excluded.add(path.join(root, p));
    }
  }
  return excluded;
}

export async function resolveInstrumentationFilter(
  context: BuilderContext,
  options: { instrumentForCoverage?: boolean; codeCoverageExclude?: string[] },
): Promise<((request: string) => boolean) | undefined> {
  if (!options.instrumentForCoverage) {
    return undefined;
  }

  const workspaceRoot = context.workspaceRoot;

  return createInstrumentationFilter(
    await getProjectSourceRoot(context),
    getInstrumentationExcludedPaths(
      workspaceRoot,
      options.codeCoverageExclude ?? [],
    ),
  );
}

// Mirrors @angular/build's getProjectSourceRoot: without a target, fall back to
// the workspace root; sourceRoot defaults to <root>/src.
async function getProjectSourceRoot(context: BuilderContext): Promise<string> {
  const projectName = context.target?.project;
  if (!projectName) {
    return context.workspaceRoot;
  }

  const projectMetadata = await context.getProjectMetadata(projectName);
  const projectRoot = path.join(
    context.workspaceRoot,
    (projectMetadata['root'] as string) ?? '',
  );
  const rawSourceRoot = projectMetadata['sourceRoot'] as string | undefined;
  return normalizeDirectoryPath(
    rawSourceRoot === undefined
      ? path.join(projectRoot, 'src')
      : path.join(context.workspaceRoot, rawSourceRoot),
  );
}

function normalizeDirectoryPath(directoryPath: string): string {
  const last = directoryPath.at(-1);
  if (last === '/' || last === '\\') {
    return directoryPath.slice(0, -1);
  }
  return directoryPath;
}
