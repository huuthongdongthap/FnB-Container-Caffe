import type { D1Database } from '@cloudflare/workers-types';

/** VN mobile numbers use domestic format; other international numbers require +. */
export function canonicalPhone(raw: string | null | undefined): string | null {
  const compact = String(raw ?? '').trim().replace(/[\s().-]/g, '');
  if (!/^\+?\d+$/.test(compact)) return null;
  let digits = compact.replace(/^\+/, '');
  if (/^84[35789]\d{8}$/.test(digits)) digits = `0${digits.slice(2)}`;
  if (/^0[35789]\d{8}$/.test(digits)) {
    return digits === '0900000000' || /^0(\d)\1{8}$/.test(digits) ? null : digits;
  }
  // Never guess a country code for malformed domestic input.
  return compact.startsWith('+') && !digits.startsWith('84') && /^[1-9]\d{8,14}$/.test(digits)
    && !/^(\d)\1+$/.test(digits) ? `+${digits}` : null;
}

export function phoneVariants(phone: string): string[] {
  return /^0[35789]\d{8}$/.test(phone)
    ? [phone, `84${phone.slice(1)}`, `+84${phone.slice(1)}`]
    : [phone];
}

/** Ambiguous historical profiles require staff reconciliation, never an implicit merge. */
export async function findContactCustomer(
  db: D1Database, tenantId: string, phone: string | null, email: string | null = null,
): Promise<{ id: string } | null> {
  const variants = phone ? phoneVariants(phone) : [];
  if (variants.length === 0 && !email) return null;
  const phoneClause = variants.length > 0 ? `phone IN (${variants.map(() => '?').join(',')})` : '0';
  const emailClause = email ? 'email = ?' : '0';
  const contactBinds = [...(email ? [email] : []), ...variants];
  let rows: Array<{ id: string }> = [];
  try {
    const result = await db.prepare(
      `SELECT id FROM customers WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
       AND (${emailClause} OR ${phoneClause}) LIMIT 2`,
    ).bind(tenantId, tenantId, ...contactBinds).all<{ id: string }>();
    rows = result?.results ?? [];
  } catch {
    if (tenantId === 'default' || tenantId === '*') {
      const result = await db.prepare(
        `SELECT id FROM customers WHERE (${emailClause} OR ${phoneClause}) LIMIT 2`,
      ).bind(...contactBinds).all<{ id: string }>().catch(() => ({ results: [] as Array<{ id: string }> }));
      rows = result?.results ?? [];
    } else {
      throw new Error('Failed tenant-scoped customer contact lookup');
    }
  }
  if (rows.length > 1) throw new Error('Ambiguous customer contact in tenant');
  return rows[0] ?? null;
}
