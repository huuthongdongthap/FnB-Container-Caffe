/**
 * Version Route — /api/version
 * Returns deployed commit SHA for deploy verification.
 */

export function getVersion(env) {
  const fullSha = String(env.GIT_COMMIT_SHA || env.CF_PAGES_COMMIT_SHA || 'unknown');
  return {
    shortSha: fullSha.slice(0, 8),
    fullSha,
    environment: String(env.ENVIRONMENT || 'unknown'),
  };
}
