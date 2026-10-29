/**
 * CORS helpers
 * Cross-Origin Resource Sharing for AURA CAFE API.
 * Converted from middleware/cors.js - maintained as exported functions
 * so unconverted routes can still import from the .js re-export shim.
 */

/**
 * Allowlist for responses built by these helpers.
 *
 * This is a *response-side* mirror of the app-level allowlist in `index.ts`
 * (`ALLOWED_ORIGIN_PATTERNS`), which is the governing policy for the app-level `cors()`
 * middleware. Handlers that build their own Response cannot rely on that middleware:
 * Hono copies the middleware's headers onto the returned Response, but a header set
 * *after* that copy wins — so a fallback origin set here silently overrides the correct
 * allowlist decision. Keep both lists in sync.
 */
const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^https:\/\/fnb-caffe-container\.pages\.dev$/,
  /^https:\/\/[a-z0-9-]+\.fnb-caffe-container\.pages\.dev$/,
  /^https:\/\/(www\.)?auraspace\.cafe$/,
  /^https:\/\/[a-z0-9-]+\.auraspace\.cafe$/,
  /^https:\/\/(www\.)?auracafe\.vn$/,
  /^https:\/\/[a-z0-9-]+\.auracafe\.vn$/,
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/
];

/** Exact origins kept for readability and for the legacy auracafe/auraspace entries. */
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8787',
  'https://auracafe.vn',
  'https://staging.auracafe.vn',
  'https://auraspace.cafe',
  'https://www.auraspace.cafe',
];

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((rx) => rx.test(origin));
}

/**
 * Resolves the origin to echo back, or `false` when the caller must not be granted
 * cross-origin reads.
 *
 * An unmatched origin never falls back to a fixed default. Emitting
 * `Access-Control-Allow-Origin: http://localhost:5173` for a request from anywhere else
 * is a lie the browser enforces anyway, it hides which origin was rejected, and it leaks
 * a dev URL in production responses. Returning `false` means "emit no ACAO", so the
 * browser blocks the read — the same outcome the app-level middleware produces.
 */
export function getCorsOrigin(originHeader?: string | null): string | false {
  if (originHeader && isAllowedOrigin(originHeader)) {
    return originHeader;
  }
  return false;
}

/**
 * Builds CORS headers for a given origin.
 *
 * `false` means "origin rejected or unknown": no `Access-Control-Allow-Origin` and no
 * `Access-Control-Allow-Credentials` are emitted, so a credentialed cross-origin read
 * fails closed. A credentialed response with `Access-Control-Allow-Origin: *` is invalid
 * under the CORS spec, so an unknown origin must not be echoed as `*` either.
 */
export function corsHeaders(origin: string | false, withCredentials = false): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-ID, X-Reset-Key, X-Request-ID, Idempotency-Key, X-Tenant-ID, X-Edge-Telemetry-Secret',
    'Access-Control-Max-Age': '86400',
  };
  // `false` (rejected) and `*` under credentials have no valid ACAO value: the CORS spec
  // forbids pairing a literal `*` with Access-Control-Allow-Credentials, and a rejected
  // caller must not be granted reads at all.
  if (origin === false || (withCredentials && origin === '*')) {
    return headers;
  }
  headers['Access-Control-Allow-Origin'] = origin;
  if (withCredentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers.Vary = 'Origin';
  }
  return headers;
}

/**
 * Resolves a caller-supplied `corsOrigin` argument.
 *
 * `'*'` is the default and means "the caller did not know the request origin". With
 * credentials that cannot be echoed literally, and it must not be swapped for a fixed
 * default, so it resolves to `false` (no ACAO). An explicit origin string is checked
 * against the allowlist.
 */
function resolveCorsOrigin(corsOrigin: string | false | undefined): string | false {
  if (typeof corsOrigin !== 'string' || corsOrigin === '' || corsOrigin === '*') {
    return false;
  }
  return getCorsOrigin(corsOrigin);
}

export function jsonResponse(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
  corsOrigin: string | false = '*',
  withCredentials = false
): Response {
  const resolved = resolveCorsOrigin(corsOrigin);
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(resolved, withCredentials),
      ...headers
    }
  });
}

/**
 * Error responses ride the same origin decision as the success path that preceded them,
 * so a rejected caller gets no `Access-Control-Allow-Origin` on a 4xx just as on a 2xx.
 */
export function errorResponse(
  message: string,
  status = 400,
  headers: Record<string, string> = {},
  corsOrigin: string | false = '*'
): Response {
  return jsonResponse(
    { success: false, error: message },
    status,
    headers,
    resolveCorsOrigin(corsOrigin),
    true
  );
}
