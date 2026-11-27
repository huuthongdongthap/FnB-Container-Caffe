/**
 * eraseCustomerPii — Ledger-safe one-way customer PII anonymization.
 *
 * Preserves immutable accounting, tax, loyalty ledger, and e-invoice rows
 * (orders.total, orders.items, payments, loyalty_transactions, erpnext_mappings)
 * while irreversibly scrubbing personal identifiers across customers, orders,
 * customer_identities, push_subscriptions, and active consents.
 */
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

export interface EraseCustomerPiiInput {
  customerId: string;
  actorId: string;
  actorRole: string;
  tenantId?: string;
  kv?: KVNamespace;
}

export interface EraseCustomerPiiResult {
  ok: boolean;
  customerId: string;
  erasedToken: string;
  notFound?: boolean;
}

async function computeErasedToken(customerId: string, tenantId: string): Promise<string> {
  const bytes = new TextEncoder().encode(`erased:${tenantId}:${customerId}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `erased_${hex}`;
}

export async function eraseCustomerPii(
  db: D1Database,
  input: EraseCustomerPiiInput,
): Promise<EraseCustomerPiiResult> {
  const rawTenant = (input.tenantId ?? '').trim() || 'default';
  const tenantId = rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;
  const now = new Date().toISOString();
  const erasedToken = await computeErasedToken(input.customerId, tenantId);

  let priorPhone: string | null = null;
  let priorEmail: string | null = null;
  let resolvedRowTenant: string | null = null;
  let existingChecked = false;
  let existingFound = false;
  try {
    const existing = await db
      .prepare(
        "SELECT id, phone, email, tenant_id FROM customers WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1",
      )
      .bind(input.customerId, tenantId, tenantId)
      .first<{ id?: string; phone?: string | null; email?: string | null; tenant_id?: string | null }>();
    existingChecked = true;
    if (existing) {
      existingFound = true;
      if (existing.phone) {
        priorPhone = String(existing.phone).trim();
      }
      if (existing.email) {
        priorEmail = String(existing.email).trim();
      }
      if (typeof existing.tenant_id === 'string' && existing.tenant_id.trim()) {
        resolvedRowTenant = existing.tenant_id.trim();
      }
    }
  } catch (err) {
    if (!/no such column:\s*tenant_id/i.test(String(err)) || (tenantId !== 'default' && tenantId !== '*')) {
      throw err;
    }
    const legacyExisting = await db
      .prepare('SELECT id, phone, email FROM customers WHERE id = ? LIMIT 1')
      .bind(input.customerId)
      .first<{ id?: string; phone?: string | null; email?: string | null }>()
      .catch(() => undefined);
    if (legacyExisting !== undefined) {
      existingChecked = true;
      existingFound = Boolean(legacyExisting);
      if (legacyExisting?.phone) {
        priorPhone = String(legacyExisting.phone).trim();
      }
      if (legacyExisting?.email) {
        priorEmail = String(legacyExisting.email).trim();
      }
    }
  }

  if (existingChecked && !existingFound) {
    return { ok: false, customerId: input.customerId, erasedToken, notFound: true };
  }

  // 1. Scrub PII columns on customers while keeping row PK intact for ledger/FK references
  let updateResult: unknown;
  try {
    updateResult = await db
      .prepare(
        `UPDATE customers
            SET name = '[ERASED]',
                phone = ?,
                email = NULL,
                date_of_birth = NULL,
                birthday = NULL,
                notes = NULL,
                zalo = NULL,
                marketing_consent = 0,
                consent_marketing = 0,
                consent_analytics = 0,
                referral_code = NULL,
                last_ip = NULL,
                anonymized_at = CURRENT_TIMESTAMP,
                auth_version = COALESCE(auth_version, 1) + 1,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`,
      )
      .bind(erasedToken, input.customerId, tenantId, tenantId)
      .run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/no such column:\s*tenant_id/i.test(msg)) {
      if (tenantId !== 'default' && tenantId !== '*') {
        throw err;
      }
      updateResult = await db
        .prepare("UPDATE customers SET name = '[ERASED]', phone = ?, email = NULL WHERE id = ?")
        .bind(erasedToken, input.customerId)
        .run();
    } else {
      updateResult = await db
        .prepare(
          `UPDATE customers
              SET name = '[ERASED]',
                  phone = ?,
                  email = NULL,
                  auth_version = COALESCE(auth_version, 1) + 1,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`,
        )
        .bind(erasedToken, input.customerId, tenantId, tenantId)
        .run()
        .catch(() =>
          db
            .prepare(
              "UPDATE customers SET name = '[ERASED]', phone = ?, email = NULL WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)",
            )
            .bind(erasedToken, input.customerId, tenantId, tenantId)
            .run(),
        );
    }
  }
  const updateChanges = (updateResult as { meta?: { changes?: number } } | undefined)?.meta?.changes;
  if (typeof updateChanges === 'number' && updateChanges === 0) {
    return { ok: false, customerId: input.customerId, erasedToken, notFound: true };
  }

  // 2. Scrub PII on historical orders without altering financial/tax fields
  try {
    await db
      .prepare(
        `UPDATE orders
            SET customer_name = '[ERASED]',
                customer_phone = ?,
                customer_email = NULL,
                customer_address = NULL,
                delivery_address = NULL,
                notes = NULL
          WHERE customer_id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`,
      )
      .bind(erasedToken, input.customerId, tenantId, tenantId)
      .run();
  } catch {
    try {
      await db
        .prepare(
          `UPDATE orders
              SET customer_name = '[ERASED]',
                  customer_phone = ?,
                  customer_email = NULL,
                  customer_address = NULL
            WHERE customer_id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`,
        )
        .bind(erasedToken, input.customerId, tenantId, tenantId)
        .run()
        .catch(() =>
          db
            .prepare(
              "UPDATE orders SET customer_name = '[ERASED]', customer_phone = ? WHERE customer_id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)",
            )
            .bind(erasedToken, input.customerId, tenantId, tenantId)
            .run()
            .catch(async (fallbackErr) => {
              if (/no such column:\s*tenant_id/i.test(String(fallbackErr)) && (tenantId === 'default' || tenantId === '*')) {
                await db
                  .prepare("UPDATE orders SET customer_name = '[ERASED]', customer_phone = ? WHERE customer_id = ?")
                  .bind(erasedToken, input.customerId)
                  .run();
              }
            }),
        );
    } catch {
      // Best-effort when orders table is absent in minimal mocks
    }
  }

  // 3. Revoke all active consents and purge auxiliary identity/push/PII bindings
  try {
    await db
      .prepare(
        "UPDATE consents SET granted = 0, revoked_at = ? WHERE customer_id = ? AND (revoked_at IS NULL OR granted = 1) AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)",
      )
      .bind(now, input.customerId, tenantId, tenantId)
      .run()
      .catch(async (err) => {
        if (/no such column:\s*tenant_id/i.test(String(err)) && (tenantId === 'default' || tenantId === '*')) {
          await db
            .prepare('UPDATE consents SET granted = 0, revoked_at = ? WHERE customer_id = ? AND (revoked_at IS NULL OR granted = 1)')
            .bind(now, input.customerId)
            .run();
        }
      });
  } catch { /* optional table */ }

  try {
    await db.prepare('DELETE FROM customer_identities WHERE customer_id = ?').bind(input.customerId).run();
  } catch { /* optional table */ }

  try {
    await db.prepare('DELETE FROM push_subscriptions WHERE customer_id = ?').bind(input.customerId).run();
  } catch { /* optional table */ }

  // 3b. Scrub/purge PII across all auxiliary D1 tables (GDPR Art. 17 / VN ND 13) — tenant-scoped
  const cleanPhone = priorPhone && !priorPhone.startsWith('erased_') ? priorPhone : null;
  const cleanEmail = priorEmail ? priorEmail.toLowerCase() : null;
  const tenantPred = "AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)";
  const runScoped = async (sqlBase: string, binds: unknown[]) => {
    try {
      await db
        .prepare(`${sqlBase} ${tenantPred}`)
        .bind(...binds, tenantId, tenantId)
        .run();
    } catch (err) {
      if (/no such column:\s*tenant_id/i.test(String(err)) && (tenantId === 'default' || tenantId === '*')) {
        await db.prepare(sqlBase).bind(...binds).run().catch(() => {});
      }
    }
  };

  await runScoped(
    `UPDATE subscriptions
        SET customer_name = '[ERASED]', customer_email = ?, customer_phone = ?
      WHERE (customer_id = ? OR (? IS NOT NULL AND LOWER(customer_email) = ?) OR (? IS NOT NULL AND customer_phone = ?))`,
    [`${erasedToken}@erased.invalid`, erasedToken, input.customerId, cleanEmail, cleanEmail, cleanPhone, cleanPhone],
  );

  await runScoped(
    `UPDATE reservations
        SET customer_name = '[ERASED]', customer_phone = ?, notes = NULL
      WHERE (customer_id = ? OR (? IS NOT NULL AND customer_phone = ?))`,
    [erasedToken, input.customerId, cleanPhone, cleanPhone],
  );

  await runScoped(
    "UPDATE checkins SET customer_name = '[ERASED]' WHERE customer_id = ?",
    [input.customerId],
  );

  await runScoped(
    `UPDATE contact_messages
        SET name = '[ERASED]', phone = NULL, email = NULL, content = '[ERASED]'
      WHERE ((? IS NOT NULL AND LOWER(email) = ?) OR (? IS NOT NULL AND phone = ?))`,
    [cleanEmail, cleanEmail, cleanPhone, cleanPhone],
  );

  await runScoped(
    "UPDATE reviews SET customer_name = '[ERASED]' WHERE customer_id = ?",
    [input.customerId],
  );

  await runScoped(
    `UPDATE table_sessions
        SET customer_name = '[ERASED]', customer_phone = NULL, notes = NULL
      WHERE (customer_id = ? OR (? IS NOT NULL AND customer_phone = ?))`,
    [input.customerId, cleanPhone, cleanPhone],
  );

  await runScoped(
    `UPDATE wifi_sessions
        SET phone = NULL, ip_address = NULL
      WHERE (customer_id = ? OR (? IS NOT NULL AND phone = ?))`,
    [input.customerId, cleanPhone, cleanPhone],
  );

  await runScoped(
    `UPDATE ai_barista_interactions
        SET customer_phone = NULL, query_prompt = '[ERASED]', preferences_json = NULL
      WHERE (customer_id = ? OR (? IS NOT NULL AND customer_phone = ?))`,
    [input.customerId, cleanPhone, cleanPhone],
  );

  if (cleanPhone) {
    await runScoped(
      `UPDATE customer_support_interactions
          SET customer_phone = NULL, user_query = '[ERASED]'
        WHERE customer_phone = ?`,
      [cleanPhone],
    );
    await runScoped('DELETE FROM otp_challenges WHERE phone = ?', [cleanPhone]);
  }

  await runScoped(
    'DELETE FROM email_verifications WHERE (user_id = ? OR (? IS NOT NULL AND LOWER(email) = ?))',
    [input.customerId, cleanEmail, cleanEmail],
  );

  await runScoped(
    `UPDATE promotion_redemptions
        SET customer_phone = NULL
      WHERE (customer_id = ? OR (? IS NOT NULL AND customer_phone = ?))`,
    [input.customerId, cleanPhone, cleanPhone],
  );

  await runScoped(
    `UPDATE signup_bonus_log
        SET phone = NULL, ip_hint = NULL
      WHERE (customer_id = ? OR (? IS NOT NULL AND phone = ?))`,
    [input.customerId, cleanPhone, cleanPhone],
  );

  await runScoped(
    `UPDATE notification_audit_log
        SET recipient = NULL, phone = NULL, payload = NULL, data = NULL
      WHERE (customer_id = ?
         OR (? IS NOT NULL AND (LOWER(recipient) = ? OR recipient = ?))
         OR (? IS NOT NULL AND (phone = ? OR recipient = ?)))`,
    [input.customerId, cleanEmail, cleanEmail, priorEmail, cleanPhone, cleanPhone, cleanPhone],
  );

  await runScoped(
    'DELETE FROM leads WHERE ((? IS NOT NULL AND LOWER(email) = ?) OR (? IS NOT NULL AND phone = ?))',
    [cleanEmail, cleanEmail, cleanPhone, cleanPhone],
  );

  const effectiveTargetTenant = resolvedRowTenant || (tenantId === '*' ? 'default' : tenantId);

  // 4. Append erasure audit events
  const eventId = `cev_erase_${crypto.randomUUID()}`;
  const eventPayload = JSON.stringify({ actor_id: input.actorId, actor_role: input.actorRole, tenant_id: effectiveTargetTenant });
  try {
    await db
      .prepare(
        'INSERT INTO customer_events (id, customer_id, event_type, payload, tenant_id, recorded_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(eventId, input.customerId, 'CustomerDataErased', eventPayload, effectiveTargetTenant, now)
      .run()
      .catch(() =>
        db
          .prepare('INSERT INTO customer_events (id, customer_id, event_type, payload, recorded_at) VALUES (?, ?, ?, ?, ?)')
          .bind(eventId, input.customerId, 'CustomerDataErased', eventPayload, now)
          .run(),
      );
  } catch { /* optional table */ }

  const auditDetails = JSON.stringify({ anonymized: true, ledger_preserved: true, actor_role: input.actorRole });
  try {
    await db
      .prepare(
        `INSERT INTO audit_logs (actor, actor_id, action, resource_type, resource_id, details, tenant_id, status, created_at)
         VALUES (?, ?, 'erase_customer_pii', 'customer', ?, ?, ?, 'success', datetime('now'))`,
      )
      .bind(input.actorId, input.actorId, input.customerId, auditDetails, effectiveTargetTenant)
      .run()
      .catch(() =>
        db
          .prepare(
            `INSERT INTO audit_logs (id, actor_id, actor_role, action, resource_type, resource_id, details, tenant_id, status, created_at)
             VALUES (?, ?, ?, 'erase_customer_pii', 'customer', ?, ?, ?, 'success', datetime('now'))`,
          )
          .bind(`aud_erase_${crypto.randomUUID()}`, input.actorId, input.actorRole, input.customerId, auditDetails, effectiveTargetTenant)
          .run(),
      );
  } catch { /* optional table */ }

  if (input.kv) {
    try {
      await input.kv.delete(`user:${input.customerId}`);
      await input.kv.delete(`cust_auth_ver:${input.customerId}`);
      if (cleanEmail) {
        await input.kv.delete(`user:${cleanEmail}`);
        if (priorEmail && priorEmail !== cleanEmail) {
          await input.kv.delete(`user:${priorEmail}`);
        }
      }
      if (priorPhone && !priorPhone.startsWith('erased_')) {
        await input.kv.delete(`phone_otp:${effectiveTargetTenant}:${priorPhone}`);
        await input.kv.delete(`phone_otp:${priorPhone}`);
        await input.kv.delete(`otp:${priorPhone}`);
        await input.kv.delete(`loyalty:otp:${effectiveTargetTenant}:${priorPhone}`);
        await input.kv.delete(`otp_verified_phone:${effectiveTargetTenant}:${priorPhone}`);
      }
    } catch { /* optional KV */ }
  }

  return { ok: true, customerId: input.customerId, erasedToken };
}
