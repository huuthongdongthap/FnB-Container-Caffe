/**
 * CORS helpers
 * Cross-Origin Resource Sharing for AURA SPACE API.
 * Converted from middleware/cors.js - maintained as exported functions
 * so unconverted routes can still import from the .js re-export shim.
 */

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8787',
  'https://auracafe.vn',
  'https://staging.auracafe.vn',
];

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return origin.endsWith('.auracafe.vn') || /^http:\/\/localhost:\d+$/.test(origin);
}

export function getCorsOrigin(originHeader?: string | null): string {
  if (originHeader && isAllowedOrigin(originHeader)) {
    return originHeader;
  }
  return ALLOWED_ORIGINS[0]!;
}

export function corsHeaders(origin: string, withCredentials = false) {
  const safeOrigin = withCredentials && (origin === '*' || !origin) ? ALLOWED_ORIGINS[0]! : origin;
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': safeOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-ID, Idempotency-Key',
    'Access-Control-Max-Age': '86400',
  };
  if (withCredentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers.Vary = 'Origin';
  }
  return headers;
}

export function jsonResponse(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
  corsOrigin = '*',
  withCredentials = false
) {
  const resolvedOrigin = withCredentials && (corsOrigin === '*' || !corsOrigin)
    ? ALLOWED_ORIGINS[0]!
    : (corsOrigin || '*');
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(resolvedOrigin, withCredentials),
      ...headers
    }
  });
}

export function errorResponse(
  message: string,
  status = 400,
  headers: Record<string, string> = {},
  corsOrigin = ALLOWED_ORIGINS[0]!
) {
  const resolvedOrigin = corsOrigin && corsOrigin !== '*' ? getCorsOrigin(corsOrigin) : ALLOWED_ORIGINS[0]!;
  return jsonResponse({ success: false, error: message }, status, headers, resolvedOrigin, true);
}
