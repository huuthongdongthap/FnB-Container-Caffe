/* eslint-disable no-console */
/**
 * Admin Audit Middleware — logs owner/staff actions to admin_audit_log table
 * Usage: wrap any admin route with audit('ACTION_NAME') as a Hono middleware
 * Must be placed AFTER requireAuth so c.get('user') is populated.
 */
export function audit(action) {
  return async (c, next) => {
    const user = c.get('user') || {};
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || '';
    const db = c.env.AURA_DB;
    const start = Date.now();

    await next();

    const statusCode = c.res ? c.res.status : 200;
    const match = c.req.path.match(/\/api\/admin\/\w+\/([^/?]+)/);
    const targetId = match ? match[1] : null;

    db?.prepare(
      `INSERT INTO admin_audit_log (id, admin_id, admin_email, admin_role, action, method, path, target_id, ip, user_agent, status_code, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      user.id || 'unknown',
      user.email || 'unknown',
      user.role || 'unknown',
      action,
      c.req.method,
      c.req.path,
      targetId,
      ip,
      userAgent,
      statusCode,
      Date.now() - start,
      new Date().toISOString()
    ).run().catch(e => console.error('[AuditLog] Insert failed:', e.message));
  };
}
