/**
 * CORS helpers
 * Cross-Origin Resource Sharing for AURA SPACE API.
 * Converted from middleware/cors.js - maintained as exported functions
 * so unconverted routes can still import from the .js re-export shim.
 */

export function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-ID',
    'Access-Control-Max-Age': '86400'
  };
}

export function jsonResponse(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
  corsOrigin = '*'
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(corsOrigin),
      ...headers
    }
  });
}

export function errorResponse(
  message: string,
  status = 400,
  headers: Record<string, string> = {},
  corsOrigin = '*'
) {
  return jsonResponse({ success: false, error: message }, status, headers, corsOrigin);
}
