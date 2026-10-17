/**
 * Admin handlers extracted from src/index.ts.
 * Keeps the router table thin; these handlers need DB + KV access.
 */

export async function getAdminCustomers(request: Request, env: Record<string, unknown>) {
  const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database;
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const search = url.searchParams.get('search') || '';
  const tier = url.searchParams.get('tier') || '';
  const offset = (page - 1) * limit;

  let query = 'SELECT id, name, phone, email, tier, cashback_balance, total_spent, visit_count, created_at FROM customers';
  let countQuery = 'SELECT COUNT(*) as total FROM customers';
  const params: unknown[] = [];
  const clauses: string[] = [];

  if (search) {
    clauses.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  if (tier) {
    clauses.push('LOWER(tier) = LOWER(?)');
    params.push(tier);
  }

  if (clauses.length > 0) {
    const where = ` WHERE ${clauses.join(' AND ')}`;
    query += where;
    countQuery += where;
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const { results } = await db.prepare(query).bind(...params, limit, offset).all();
  const totalRow = await db.prepare(countQuery).bind(...params).first<{ total: number }>();
  const total = totalRow?.total ?? 0;
  const customers = (results || []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      ...r,
      totalOrders: Number(r.totalOrders ?? r.visit_count ?? 0),
      totalSpent: Number(r.totalSpent ?? r.total_spent ?? 0),
      lastVisit: String(r.lastVisit ?? r.updated_at ?? r.created_at ?? ''),
    };
  });
  return Response.json({ success: true, data: customers, customers, pagination: { page, limit, total } });
}

export async function createAdminCustomer(request: Request, env: Record<string, unknown>) {
  const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    phone?: string;
    email?: string;
    tier?: string;
  };
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const email = body.email ? String(body.email).trim() : null;
  const tier = String(body.tier || 'bronze').trim().toLowerCase();
  if (!name || !phone) {
    return Response.json({ success: false, error: 'name and phone are required' }, { status: 400 });
  }
  const id = `c_${Date.now()}`;
  const now = new Date().toISOString();
  await db
    .prepare(
      'INSERT INTO customers (id, name, phone, email, tier, cashback_balance, total_spent, visit_count, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?)'
    )
    .bind(id, name, phone, email, tier, now)
    .run();
  return Response.json(
    {
      success: true,
      customer: {
        id,
        name,
        phone,
        email,
        tier,
        totalOrders: 0,
        totalSpent: 0,
        lastVisit: now,
      },
    },
    { status: 201 }
  );
}

export async function updateAdminCustomer(request: Request, env: Record<string, unknown>, id: string) {
  const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    phone?: string;
    email?: string;
    tier?: string;
  };
  const updates: string[] = [];
  const params: unknown[] = [];
  if (typeof body.name === 'string' && body.name.trim()) {
    updates.push('name = ?');
    params.push(body.name.trim());
  }
  if (typeof body.phone === 'string' && body.phone.trim()) {
    updates.push('phone = ?');
    params.push(body.phone.trim());
  }
  if (typeof body.email === 'string') {
    updates.push('email = ?');
    params.push(body.email.trim() || null);
  }
  if (typeof body.tier === 'string' && body.tier.trim()) {
    updates.push('tier = ?');
    params.push(body.tier.trim().toLowerCase());
  }
  if (updates.length === 0) {
    return Response.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }
  params.push(id);
  await db.prepare(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
  return Response.json({ success: true, id });
}

export async function deleteAdminCustomer(env: Record<string, unknown>, id: string) {
  const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database;
  await db.prepare('DELETE FROM customers WHERE id = ?').bind(id).run();
  return Response.json({ success: true, id });
}

export async function getStuckPayments(request: Request, env: Record<string, unknown>) {
  const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
  if (!kv) {
    return Response.json({ stuck: [], dlq: [], total: 0 });
  }

  const stuckList = await kv.list({ prefix: 'payment:stuck:' });
  const dlqList = await kv.list({ prefix: 'webhook:dlq:' });

  const stuck = await Promise.all(
    stuckList.keys.slice(0, 20).map(async(k) => {
      const raw = await kv.get(k.name);
      return raw ? JSON.parse(raw) : null;
    })
  );

  const dlq = await Promise.all(
    dlqList.keys.slice(0, 20).map(async(k) => {
      const raw = await kv.get(k.name);
      return raw ? { key: k.name, ...JSON.parse(raw) } : null;
    })
  );

  return Response.json({
    stuck: stuck.filter(Boolean).map((s: Record<string, unknown>) => ({ ...s, amount: '***' })),
    dlq: dlq.filter(Boolean),
    total: stuckList.keys.length + dlqList.keys.length
  });
}
