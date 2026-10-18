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

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (search) {
    clauses.push('(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  if (tier) {
    clauses.push('LOWER(c.loyalty_tier) = LOWER(?)');
    params.push(tier);
  }

  const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
  const canonicalQuery = `SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.loyalty_tier AS tier, COALESCE(cw.balance, 0) AS cashback_balance, COALESCE(cw.total_spent, 0) AS total_spent, (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone) AS visit_count, c.created_at, c.updated_at FROM customers c LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
  const canonicalCountQuery = `SELECT COUNT(*) as total FROM customers c${where}`;

  let results: unknown[] = [];
  let total = 0;

  try {
    const queryRes = await db.prepare(canonicalQuery).bind(...params, limit, offset).all();
    results = queryRes.results || [];
    const totalRow = await db.prepare(canonicalCountQuery).bind(...params).first<{ total: number }>();
    total = totalRow?.total ?? 0;
  } catch {
    const legacyClauses: string[] = [];
    const legacyParams: unknown[] = [];
    if (search) {
      legacyClauses.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)');
      const like = `%${search}%`;
      legacyParams.push(like, like, like);
    }
    if (tier) {
      legacyClauses.push('LOWER(tier) = LOWER(?)');
      legacyParams.push(tier);
    }
    const legacyWhere = legacyClauses.length > 0 ? ` WHERE ${legacyClauses.join(' AND ')}` : '';
    const legacyQuery = `SELECT id, name, phone, email, tier, cashback_balance, total_spent, visit_count, created_at FROM customers${legacyWhere} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const legacyCountQuery = `SELECT COUNT(*) as total FROM customers${legacyWhere}`;
    const queryRes = await db.prepare(legacyQuery).bind(...legacyParams, limit, offset).all();
    results = queryRes.results || [];
    const totalRow = await db.prepare(legacyCountQuery).bind(...legacyParams).first<{ total: number }>();
    total = totalRow?.total ?? 0;
  }

  const customers = (results || []).map((row) => {
    const r = row as Record<string, unknown>;
    const normalizedTier = String(r.tier ?? r.loyalty_tier ?? 'bronze');
    return {
      ...r,
      tier: normalizedTier,
      loyalty_tier: normalizedTier.toLowerCase(),
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
  const tier = String(body.tier || 'bronze').trim().toLowerCase();
  if (!name || !phone) {
    return Response.json({ success: false, error: 'name and phone are required' }, { status: 400 });
  }
  const id = `c_${Date.now()}`;
  const now = new Date().toISOString();
  const sanitizedPhone = phone.replace(/\D/g, '') || id;
  const email = body.email && String(body.email).trim()
    ? String(body.email).trim()
    : `${sanitizedPhone}@loyalty.aura`;

  try {
    await db
      .prepare(
        'INSERT INTO customers (id, email, name, phone, loyalty_tier, loyalty_points, lifetime_points, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?)'
      )
      .bind(id, email, name, phone, tier, 'admin', now, now)
      .run();
  } catch {
    try {
      await db
        .prepare(
          'INSERT INTO customers (id, email, name, phone, loyalty_tier, loyalty_points, lifetime_points, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)'
        )
        .bind(id, email, name, phone, tier, now, now)
        .run();
    } catch {
      await db
        .prepare(
          'INSERT INTO customers (id, name, phone, email, tier, cashback_balance, total_spent, visit_count, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?)'
        )
        .bind(id, name, phone, email, tier, now)
        .run();
    }
  }

  return Response.json(
    {
      success: true,
      customer: {
        id,
        name,
        phone,
        email,
        tier,
        loyalty_tier: tier,
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
  const baseUpdates: string[] = [];
  const baseParams: unknown[] = [];
  if (typeof body.name === 'string' && body.name.trim()) {
    baseUpdates.push('name = ?');
    baseParams.push(body.name.trim());
  }
  if (typeof body.phone === 'string' && body.phone.trim()) {
    baseUpdates.push('phone = ?');
    baseParams.push(body.phone.trim());
  }
  if (typeof body.email === 'string' && body.email.trim()) {
    baseUpdates.push('email = ?');
    baseParams.push(body.email.trim());
  }
  const hasTier = typeof body.tier === 'string' && Boolean(body.tier.trim());
  if (baseUpdates.length === 0 && !hasTier) {
    return Response.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  const tierValue = hasTier ? body.tier!.trim().toLowerCase() : null;
  try {
    const canonicalUpdates = [...baseUpdates];
    const canonicalParams = [...baseParams];
    if (tierValue) {
      canonicalUpdates.push('loyalty_tier = ?');
      canonicalParams.push(tierValue);
    }
    canonicalParams.push(id);
    await db.prepare(`UPDATE customers SET ${canonicalUpdates.join(', ')} WHERE id = ?`).bind(...canonicalParams).run();
  } catch {
    const legacyUpdates = [...baseUpdates];
    const legacyParams = [...baseParams];
    if (tierValue) {
      legacyUpdates.push('tier = ?');
      legacyParams.push(tierValue);
    }
    legacyParams.push(id);
    await db.prepare(`UPDATE customers SET ${legacyUpdates.join(', ')} WHERE id = ?`).bind(...legacyParams).run();
  }
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
