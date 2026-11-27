/**
 * Canonical Security Headers and CORS Policy
 * Strictly enforces OWASP defensive headers and origin isolation.
 */

export const CANONICAL_SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '0',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
};

export const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^https:\/\/fnb-caffe-container\.pages\.dev$/,
  /^https:\/\/[a-z0-9-]+\.fnb-caffe-container\.pages\.dev$/,
  /^https:\/\/(www\.)?auraspace\.cafe$/,
  /^https:\/\/[a-z0-9-]+\.auraspace\.cafe$/,
  /^https:\/\/(www\.)?auracafe\.vn$/,
  /^https:\/\/[a-z0-9-]+\.auracafe\.vn$/
];

export const DEV_LOCALHOST_ORIGIN_PATTERNS: RegExp[] = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/
];

export function isAllowedOrigin(origin?: string | null, environment?: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGIN_PATTERNS.some((rx) => rx.test(origin))) return true;
  const envName = String(environment || '').toLowerCase();
  if ((envName === 'development' || envName === 'test') && DEV_LOCALHOST_ORIGIN_PATTERNS.some((rx) => rx.test(origin))) {
    return true;
  }
  return false;
}
