import { NormalizedFederationConfig } from '../config/federation-config';
import { logger } from './logger';
import { normalizePackageName } from './normalize';

export function resolveProjectName(config: NormalizedFederationConfig): string {
  const normalizedProjectName = normalizePackageName(config.name);
  if (normalizedProjectName.length < 1) {
    logger.warn(
      "Project name in 'federation.config.js' is empty, defaulting to 'shell' cache folder (could collide with other projects in the workspace).",
    );
  }

  return normalizedProjectName.length < 1 ? 'shell' : normalizedProjectName;
}
