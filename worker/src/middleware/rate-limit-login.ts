// ── Rate Limiter for Login (in-memory, per-isolate) ──
// Limits: 5 attempts per IP per 5 minutes
const _loginAttempts = new Map<string, number[]>();
const LOGIN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const LOGIN_MAX = 5;

/* eslint-disable no-unused-vars -- type params mirror Hono middleware/json signatures: names are contract-shape only */
interface HonoContext {
  req: { raw: Request };
  json: (_body: Record<string, unknown>, _status: number) => Response;
}

export function loginRateLimit(): (c: HonoContext, next: () => Promise<Response>) => Promise<Response> {
  return async(c: HonoContext, next: () => Promise<Response>): Promise<Response> => {
    /* eslint-enable no-unused-vars */
    const ip = c.req.raw.headers.get('CF-Connecting-IP') || 'unknown';
    const now = Date.now();
    const key = `login:${ip}`;
    const record = _loginAttempts.get(key);

    if (record) {
      const recent = record.filter(t => now - t < LOGIN_WINDOW_MS);
      if (recent.length >= LOGIN_MAX) {
        return c.json({
          error: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 5 phút.',
          retry_after: Math.ceil((recent[0] + LOGIN_WINDOW_MS - now) / 1000)
        }, 429);
      }
      _loginAttempts.set(key, recent);
    }

    const response = await next();

    if (response.status === 401) {
      const rec = _loginAttempts.get(key) || [];
      rec.push(now);
      _loginAttempts.set(key, rec);
    }

    return response;
  };
}
