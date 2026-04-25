/**
 * CORS Middleware
 * Cross-Origin Resource Sharing headers cho AURA SPACE API
 */

/**
 * Tạo CORS headers
 * @param {string} origin - Origin domain (default: '*')
 * @returns {Record<string, string>} CORS headers object
 */
export function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-ID',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Tạo JSON response với CORS headers
 * @param {any} data - Response data
 * @param {number} status - HTTP status code
 * @param {Record<string, string>} headers - Custom headers
 * @returns {Response} Response object
 */
export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
      ...headers,
    },
  });
}

/**
 * Tạo error response
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {Record<string, string>} headers - Custom headers
 * @returns {Response} Error response
 */
export function errorResponse(message, status = 400, headers = {}) {
  return jsonResponse({ success: false, error: message }, status, headers);
}
