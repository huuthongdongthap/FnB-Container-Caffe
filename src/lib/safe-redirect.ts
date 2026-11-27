/**
 * Safe redirect and external payment URL validation helpers (OWASP A01 / CWE-601).
 */

const ALLOWED_PAYMENT_HOST_PATTERNS: RegExp[] = [
  /^(?:[a-z0-9-]+\.)?payos\.vn$/i,
  /^(?:[a-z0-9-]+\.)?auraspace\.cafe$/i,
  /^(?:[a-z0-9-]+\.)?auracafe\.vn$/i,
];

/**
 * Validates that a relative redirect target stays on the current origin.
 * Rejects protocol-relative URLs (`//evil.com`), backslash tricks (`/\evil.com`),
 * and non-http(s) schemes (`javascript:`).
 */
export function sanitizeInternalRedirect(
  nextPath: string | null | undefined,
  fallback = '/account',
  originOverride?: string,
): string {
  if (!nextPath || typeof nextPath !== 'string') {
    return fallback;
  }
  const trimmed = nextPath.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\') || trimmed.includes('\\')) {
    return fallback;
  }
  const baseOrigin =
    originOverride ||
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://auraspace.cafe');
  try {
    const parsed = new URL(trimmed, baseOrigin);
    if (parsed.origin !== baseOrigin) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Validates that an external payment redirect URL uses HTTPS and points to an
 * allowlisted payment gateway host (PayOS) or the current origin.
 */
export function isAllowedPaymentUrl(
  url: string | null | undefined,
  originOverride?: string,
): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') {
      return false;
    }
    const baseOrigin =
      originOverride ||
      (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');
    if (baseOrigin && parsed.origin === baseOrigin) {
      return true;
    }
    return ALLOWED_PAYMENT_HOST_PATTERNS.some((rx) => rx.test(parsed.hostname));
  } catch {
    return false;
  }
}
