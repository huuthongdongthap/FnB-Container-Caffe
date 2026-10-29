// Helper functions extracted from routes/auth.ts

export function generateId(prefix = 'ID_') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

export async function parseJSON(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON body');
  }
}

export async function findExistingOwner(env: {
  AUTH_KV: import('@cloudflare/workers-types').KVNamespace;
  AURA_DB?: import('@cloudflare/workers-types').D1Database;
}) {
  let d1QueriedSuccessfully = false;
  if (env.AURA_DB) {
    try {
      const dbOwner = await env.AURA_DB
        .prepare("SELECT id, name, created_at FROM users WHERE role = 'owner' AND is_active = 1 LIMIT 1")
        .first<{ id: string; name: string | null; created_at: string | null }>();
      d1QueriedSuccessfully = true;
      if (dbOwner) {
        return { email: dbOwner.id, name: dbOwner.name || '', created_at: dbOwner.created_at || null };
      }
    } catch {
      // Fallback to KV check when users table is not yet initialized
    }
  }
  let cursor: string | undefined;
  let pages = 0;
  // When D1 is active and confirmed no owner in users, bound legacy KV fallback
  // to a single small page so Cloudflare Worker subrequest limits cannot be exhausted.
  const maxPages = d1QueriedSuccessfully ? 1 : 5;
  const pageLimit = d1QueriedSuccessfully ? 100 : 200;
  do {
    const opts: { prefix: string; limit: number; cursor?: string } = { prefix: 'user:', limit: pageLimit };
    if (cursor) {
      opts.cursor = cursor;
    }
    const page = await env.AUTH_KV.list(opts);
    for (const key of page.keys) {
      const userStr = await env.AUTH_KV.get(key.name);
      if (!userStr) {
        continue;
      }
      try {
        const u = JSON.parse(userStr);
        if (u.role === 'owner') {
          return { email: u.email, name: u.name || '', created_at: u.created_at || null };
        }
      } catch { /* skip malformed */ }
    }
    cursor = page.list_complete ? undefined : (page as unknown as { cursor?: string }).cursor;
    pages += 1;
  } while (cursor && pages < maxPages);
  return null;
}
