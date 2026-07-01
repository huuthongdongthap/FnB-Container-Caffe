/**
 * Version Route — /api/version
 * Returns deployed commit SHA for deploy verification.
 */

import type { Env } from '../types/env';

export interface VersionResponse {
  shortSha: string;
  fullSha: string;
  environment: string;
}

export function getVersion(env: Env): VersionResponse {
  const fullSha = String(env.GIT_COMMIT_SHA || env.CF_PAGES_COMMIT_SHA || 'unknown');
  return {
    shortSha: fullSha.slice(0, 8),
    fullSha,
    environment: String(env.ENVIRONMENT || 'unknown'),
  };
}
