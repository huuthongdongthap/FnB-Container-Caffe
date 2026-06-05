
// ── Rate Limiter for Login (in-memory, per-isolate) ──
// Limits: 5 attempts per IP per 5 minutes
const _loginAttempts = new Map();
const LOGIN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const LOGIN_MAX = 5;

export function loginRateLimit() {
  return async (c, next) => {
    const ip = c.req.raw.headers.get('CF-Connecting-IP') || 'unknown';
    const now = Date.now();
    const key = `login:${ip}`;
    const record = _loginAttempts.get(key);

    if (record) {
      // Clean old entries
      const recent = record.filter(t => now - t < LOGIN_WINDOW_MS);
      if (recent.length >= LOGIN_MAX) {
        return c.json({ error: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 5 phút.', retry_after: Math.ceil((recent[0] + LOGIN_WINDOW_MS - now) / 1000) }, 429);
      }
      _loginAttempts.set(key, recent);
    }

    // Call the route
    const response = await next();

    // If login failed, record the attempt
    if (response.status === 401) {
      const rec = _loginAttempts.get(key) || [];
      rec.push(now);
      _loginAttempts.set(key, rec);
    }

    return response;
  };
}
