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
  kvCleanupFailed?: boolean;
  kvCleanupErrors?: string[];
}

function buildPhoneVariants(rawPhone: string | null): string[] {
  if (!rawPhone) return [];
  const trimmed = rawPhone.trim();
  if (!trimmed || trimmed.startsWith('erased_')) return [];
  const stripped = trimmed.replace(/[\s\-().]/g, '');
  const digits = stripped.replace(/\D/g, '');
  const variants = new Set<string>([trimmed]);
  if (stripped) variants.add(stripped);
  if (digits) variants.add(digits);
  let local = digits;
  if (digits.startsWith('84') && digits.length >= 10) {
    local = `0${digits.slice(2)}`;
    variants.add(local);
    variants.add(`+${digits}`);
  } else if (digits.startsWith('0') && digits.length >= 9) {
    const intl = `84${digits.slice(1)}`;
    variants.add(intl);
    variants.add(`+${intl}`);
  }
  if (local && local.startsWith('0') && local.length >= 9) {
    const intl = `84${local.slice(1)}`;
    variants.add(intl);
    variants.add(`+${intl}`);
  }
  return Array.from(variants);
}

function kvKeyCategory(key: string): string {
  const colonIdx = key.indexOf(':');
  return colonIdx > 0 ? key.slice(0, colonIdx) : 'kv_key';
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

  const effectiveTargetTenant = resolvedRowTenant || (tenantId === '*' ? 'default' : tenantId);
  const erasedToken = await computeErasedToken(input.customerId, effectiveTargetTenant);

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
        .prepare(
          "UPDATE customers SET name = '[ERASED]', phone = ?, email = NULL, anonymized_at = CURRENT_TIMESTAMP, auth_version = COALESCE(auth_version, 1) + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(erasedToken, input.customerId)
        .run()
        .catch(() =>
          db
            .prepare("UPDATE customers SET name = '[ERASED]', phone = ?, email = NULL, anonymized_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(erasedToken, input.customerId)
            .run(),
        )
        .catch(() =>
          db
            .prepare("UPDATE customers SET name = '[ERASED]', phone = ?, email = NULL WHERE id = ?")
            .bind(erasedToken, input.customerId)
            .run(),
        );
    } else {
      updateResult = await db
        .prepare(
          `UPDATE customers
              SET name = '[ERASED]',
                  phone = ?,
                  email = NULL,
                  anonymized_at = CURRENT_TIMESTAMP,
                  auth_version = COALESCE(auth_version, 1) + 1,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`,
        )
        .bind(erasedToken, input.customerId, tenantId, tenantId)
        .run()
        .catch(() =>
          db
            .prepare(
              `UPDATE customers
                  SET name = '[ERASED]',
                      phone = ?,
                      email = NULL,
                      anonymized_at = CURRENT_TIMESTAMP
                WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`,
            )
            .bind(erasedToken, input.customerId, tenantId, tenantId)
            .run(),
        )
        .catch(() =>
          db
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
            .run(),
        )
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

  const cleanPhone = priorPhone && !priorPhone.startsWith('erased_') ? priorPhone : null;
  const phoneVariants = buildPhoneVariants(cleanPhone);
  const cleanEmail = priorEmail ? priorEmail.toLowerCase() : null;
  const tenantPred = "AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
  const runScoped = async (sqlBase: string, binds: unknown[]) => {
    try {
      await db
        .prepare(`${sqlBase} ${tenantPred}`)
        .bind(...binds, effectiveTargetTenant)
        .run();
    } catch (err) {
      if (/no such column:\s*tenant_id/i.test(String(err)) && effectiveTargetTenant === 'default') {
        await db.prepare(sqlBase).bind(...binds).run().catch(() => {});
      }
    }
  };

  // 2. Scrub PII on historical orders (registered and guest orders) without altering financial/tax fields
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
          WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
      )
      .bind(erasedToken, input.customerId, effectiveTargetTenant)
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
            WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
        )
        .bind(erasedToken, input.customerId, effectiveTargetTenant)
        .run()
        .catch(() =>
          db
            .prepare(
              "UPDATE orders SET customer_name = '[ERASED]', customer_phone = ? WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
            )
            .bind(erasedToken, input.customerId, effectiveTargetTenant)
            .run()
            .catch(async (fallbackErr) => {
              if (/no such column:\s*tenant_id/i.test(String(fallbackErr)) && effectiveTargetTenant === 'default') {
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

  if (phoneVariants.length > 0 || cleanEmail) {
    const guestConds: string[] = [];
    const guestBinds: unknown[] = [];
    if (cleanEmail) {
      guestConds.push("LOWER(TRIM(COALESCE(customer_email, ''))) = ?");
      guestBinds.push(cleanEmail);
    }
    if (phoneVariants.length > 0) {
      const phPlaceholders = phoneVariants.map(() => '?').join(', ');
      guestConds.push(
        `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(COALESCE(customer_phone, '')), ' ', ''), '-', ''), '.', ''), '(', ''), ')', '') IN (${phPlaceholders})`,
      );
      guestBinds.push(...phoneVariants);
    }
    const guestWhere = `(customer_id IS NULL OR TRIM(customer_id) = '') AND (${guestConds.join(' OR ')})`;
    const runGuestOrderScrub = async (setClause: string, whereClause: string, binds: unknown[]) => {
      await db
        .prepare(`UPDATE orders SET ${setClause} WHERE ${whereClause} ${tenantPred}`)
        .bind(erasedToken, ...binds, effectiveTargetTenant)
        .run();
    };
    try {
      await runGuestOrderScrub(
        "customer_name = '[ERASED]', customer_phone = ?, customer_email = NULL, customer_address = NULL, delivery_address = NULL, notes = NULL",
        guestWhere,
        guestBinds,
      );
    } catch {
      try {
        await runGuestOrderScrub(
          "customer_name = '[ERASED]', customer_phone = ?, customer_email = NULL, customer_address = NULL",
          guestWhere,
          guestBinds,
        );
      } catch {
        if (phoneVariants.length > 0) {
          const phPlaceholders = phoneVariants.map(() => '?').join(', ');
          const phoneOnlyWhere = `(customer_id IS NULL OR TRIM(customer_id) = '') AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(COALESCE(customer_phone, '')), ' ', ''), '-', ''), '.', ''), '(', ''), ')', '') IN (${phPlaceholders})`;
          await runGuestOrderScrub(
            "customer_name = '[ERASED]', customer_phone = ?",
            phoneOnlyWhere,
            phoneVariants,
          ).catch(async (fallbackErr) => {
            if (/no such column:\s*tenant_id/i.test(String(fallbackErr)) && effectiveTargetTenant === 'default') {
              await db
                .prepare(`UPDATE orders SET customer_name = '[ERASED]', customer_phone = ? WHERE ${phoneOnlyWhere}`)
                .bind(erasedToken, ...phoneVariants)
                .run()
                .catch(() => {});
            }
          });
        }
      }
    }
  }

  // 3. Revoke all active consents and purge tenant-scoped identity, push, and customer account credentials
  try {
    await db
      .prepare(
        "UPDATE consents SET granted = 0, revoked_at = ? WHERE customer_id = ? AND (revoked_at IS NULL OR granted = 1) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
      )
      .bind(now, input.customerId, effectiveTargetTenant)
      .run()
      .catch(async (err) => {
        if (/no such column:\s*tenant_id/i.test(String(err)) && effectiveTargetTenant === 'default') {
          await db
            .prepare('UPDATE consents SET granted = 0, revoked_at = ? WHERE customer_id = ? AND (revoked_at IS NULL OR granted = 1)')
            .bind(now, input.customerId)
            .run();
        }
      });
  } catch { /* optional table */ }

  await runScoped('DELETE FROM customer_identities WHERE customer_id = ?', [input.customerId]);
  await runScoped('DELETE FROM push_subscriptions WHERE customer_id = ?', [input.customerId]);

  // Discover and scrub only customer-role rows in users (never modify staff/admin accounts)
  const matchedUserIdSet = new Set<string>([input.customerId]);
  const customerRolePred = "LOWER(TRIM(COALESCE(role, ''))) = 'customer'";
  const userMatchConds: string[] = ['id = ?'];
  const userMatchBinds: unknown[] = [input.customerId];
  if (cleanEmail) {
    userMatchConds.push("LOWER(TRIM(COALESCE(email, ''))) = ?");
    userMatchBinds.push(cleanEmail);
  }
  if (phoneVariants.length > 0) {
    const phPlaceholders = phoneVariants.map(() => '?').join(', ');
    userMatchConds.push(
      `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(COALESCE(phone, '')), ' ', ''), '-', ''), '.', ''), '(', ''), ')', '') IN (${phPlaceholders})`,
    );
    userMatchBinds.push(...phoneVariants);
  }
  const collectUserIds = async (sql: string, binds: unknown[]) => {
    const stmt = db.prepare(sql).bind(...binds) as {
      all?: <T>() => Promise<{ results?: T[] }>;
      first?: <T>() => Promise<T | null>;
    };
    if (typeof stmt.all === 'function') {
      const res = await stmt.all<{ id?: string }>();
      for (const row of res?.results || []) {
        if (row?.id) matchedUserIdSet.add(String(row.id));
      }
    } else if (typeof stmt.first === 'function') {
      const row = await stmt.first<{ id?: string }>();
      if (row?.id) matchedUserIdSet.add(String(row.id));
    }
  };
  try {
    await collectUserIds(
      `SELECT id FROM users WHERE ${customerRolePred} AND (${userMatchConds.join(' OR ')}) ${tenantPred}`,
      [...userMatchBinds, effectiveTargetTenant],
    );
  } catch (err) {
    const msg = String(err);
    if (/no such column:\s*email/i.test(msg)) {
      const noEmailConds = ['id = ?'];
      const noEmailBinds: unknown[] = [input.customerId];
      if (phoneVariants.length > 0) {
        const phPlaceholders = phoneVariants.map(() => '?').join(', ');
        noEmailConds.push(
          `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(COALESCE(phone, '')), ' ', ''), '-', ''), '.', ''), '(', ''), ')', '') IN (${phPlaceholders})`,
        );
        noEmailBinds.push(...phoneVariants);
      }
      await collectUserIds(
        `SELECT id FROM users WHERE ${customerRolePred} AND (${noEmailConds.join(' OR ')}) ${tenantPred}`,
        [...noEmailBinds, effectiveTargetTenant],
      ).catch(() => {});
    } else if (/no such column:\s*tenant_id/i.test(msg) && effectiveTargetTenant === 'default') {
      await collectUserIds(
        `SELECT id FROM users WHERE ${customerRolePred} AND (${userMatchConds.join(' OR ')})`,
        userMatchBinds,
      ).catch(() => {});
    }
  }

  const matchedUserIds = Array.from(matchedUserIdSet);
  const uidPlaceholders = matchedUserIds.map(() => '?').join(', ');
  const userScrubWhere = `${customerRolePred} AND id IN (${uidPlaceholders})`;
  const tryScrubCustomerUsers = async (setClause: string) => {
    await db
      .prepare(`UPDATE users SET ${setClause} WHERE ${userScrubWhere} ${tenantPred}`)
      .bind(erasedToken, ...matchedUserIds, effectiveTargetTenant)
      .run();
  };
  try {
    await tryScrubCustomerUsers(
      "name = '[ERASED]', phone = ?, email = NULL, full_name = NULL, username = NULL, avatar_url = NULL, password_hash = NULL, is_active = 0, auth_version = COALESCE(auth_version, 1) + 1, updated_at = CURRENT_TIMESTAMP",
    );
  } catch {
    try {
      await tryScrubCustomerUsers(
        "name = '[ERASED]', phone = ?, email = NULL, password_hash = NULL, is_active = 0, auth_version = COALESCE(auth_version, 1) + 1, updated_at = CURRENT_TIMESTAMP",
      );
    } catch {
      try {
        await tryScrubCustomerUsers(
          "name = '[ERASED]', phone = ?, password_hash = NULL, is_active = 0, auth_version = COALESCE(auth_version, 1) + 1, updated_at = CURRENT_TIMESTAMP",
        );
      } catch (err) {
        if (/no such column:\s*tenant_id/i.test(String(err)) && effectiveTargetTenant === 'default') {
          await db
            .prepare(
              `UPDATE users SET name = '[ERASED]', phone = ?, email = NULL, password_hash = NULL, is_active = 0, auth_version = COALESCE(auth_version, 1) + 1 WHERE ${userScrubWhere}`,
            )
            .bind(erasedToken, ...matchedUserIds)
            .run()
            .catch(() =>
              db
                .prepare(`UPDATE users SET name = '[ERASED]', phone = ?, is_active = 0 WHERE ${userScrubWhere}`)
                .bind(erasedToken, ...matchedUserIds)
                .run()
                .catch(() => {}),
            );
        }
      }
    }
  }

  // Purge auth sessions, password resets, and email OTP codes for verified customer accounts
  try {
    await db
      .prepare(`DELETE FROM sessions WHERE user_id IN (${uidPlaceholders}) ${tenantPred}`)
      .bind(...matchedUserIds, effectiveTargetTenant)
      .run()
      .catch(async (err) => {
        if (/no such column:\s*tenant_id/i.test(String(err))) {
          await db
            .prepare(`DELETE FROM sessions WHERE user_id IN (${uidPlaceholders})`)
            .bind(...matchedUserIds)
            .run();
        }
      });
  } catch { /* optional table */ }

  try {
    await db
      .prepare(
        `DELETE FROM password_resets WHERE (user_id IN (${uidPlaceholders}) OR (? IS NOT NULL AND LOWER(email) = ?)) ${tenantPred}`,
      )
      .bind(...matchedUserIds, cleanEmail, cleanEmail, effectiveTargetTenant)
      .run()
      .catch(async (err) => {
        if (/no such column:\s*tenant_id/i.test(String(err))) {
          await db
            .prepare(
              `DELETE FROM password_resets
                WHERE user_id IN (${uidPlaceholders})
                   OR (? IS NOT NULL AND LOWER(email) = ? AND NOT EXISTS (
                        SELECT 1 FROM users u
                         WHERE LOWER(COALESCE(u.email, '')) = ?
                           AND (LOWER(TRIM(COALESCE(u.role, ''))) != 'customer'
                                OR COALESCE(NULLIF(TRIM(u.tenant_id), ''), 'default') != ?)
                      ))`,
            )
            .bind(...matchedUserIds, cleanEmail, cleanEmail, cleanEmail, effectiveTargetTenant)
            .run()
            .catch(async () => {
              await db
                .prepare(`DELETE FROM password_resets WHERE user_id IN (${uidPlaceholders}) OR (? IS NOT NULL AND LOWER(email) = ?)`)
                .bind(...matchedUserIds, cleanEmail, cleanEmail)
                .run()
                .catch(() => {});
            });
        }
      });
  } catch { /* optional table */ }

  if (cleanEmail) {
    try {
      await db
        .prepare(`DELETE FROM otp_codes WHERE LOWER(email) = ? ${tenantPred}`)
        .bind(cleanEmail, effectiveTargetTenant)
        .run()
        .catch(async (err) => {
          if (/no such column:\s*tenant_id/i.test(String(err))) {
            await db
              .prepare(
                `DELETE FROM otp_codes
                  WHERE LOWER(email) = ?
                    AND NOT EXISTS (
                      SELECT 1 FROM users u
                       WHERE LOWER(COALESCE(u.email, '')) = ?
                         AND (LOWER(TRIM(COALESCE(u.role, ''))) != 'customer'
                              OR COALESCE(NULLIF(TRIM(u.tenant_id), ''), 'default') != ?)
                    )`,
              )
              .bind(cleanEmail, cleanEmail, effectiveTargetTenant)
              .run()
              .catch(async () => {
                await db.prepare('DELETE FROM otp_codes WHERE LOWER(email) = ?').bind(cleanEmail).run().catch(() => {});
              });
          }
        });
    } catch { /* optional table */ }
  }

  // 3b. Scrub/purge PII across all auxiliary D1 tables — scoped to concrete target tenant

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
    `DELETE FROM email_verifications WHERE (user_id IN (${uidPlaceholders}) OR (? IS NOT NULL AND LOWER(email) = ?))`,
    [...matchedUserIds, cleanEmail, cleanEmail],
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

  const kvCleanupErrors: string[] = [];
  if (input.kv) {
    const deleteKvWithRetry = async (key: string) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await input.kv!.delete(key);
          return;
        } catch (err) {
          if (attempt === 1) {
            const category = kvKeyCategory(key);
            kvCleanupErrors.push(category);
            console.error('eraseCustomerPii KV cleanup failed', {
              customerId: input.customerId,
              tenantId: effectiveTargetTenant,
              category,
              error: err instanceof Error ? err.message : 'kv_delete_error',
            });
          }
        }
      }
    };

    const canDeleteEmailKvKey = async (emailKey: string): Promise<boolean> => {
      if (typeof input.kv?.get !== 'function') return true;
      try {
        const raw = await input.kv.get(emailKey);
        if (!raw) return true;
        const parsed = JSON.parse(raw) as { role?: string } | null;
        if (parsed && typeof parsed.role === 'string' && parsed.role.trim().toLowerCase() !== 'customer') {
          return false;
        }
      } catch {
        // Delete unparseable or failing lookup so stale customer caches cannot linger
      }
      return true;
    };

    const keysToDelete = new Set<string>();
    for (const uid of matchedUserIds) {
      keysToDelete.add(`user:${uid}`);
      keysToDelete.add(`cust_auth_ver:${uid}`);
    }
    if (cleanEmail && (await canDeleteEmailKvKey(`user:${cleanEmail}`))) {
      keysToDelete.add(`user:${cleanEmail}`);
    }
    if (priorEmail && priorEmail !== cleanEmail && (await canDeleteEmailKvKey(`user:${priorEmail}`))) {
      keysToDelete.add(`user:${priorEmail}`);
    }
    for (const phoneVariant of phoneVariants) {
      keysToDelete.add(`phone_otp:${effectiveTargetTenant}:${phoneVariant}`);
      keysToDelete.add(`phone_otp:${phoneVariant}`);
      keysToDelete.add(`otp:${phoneVariant}`);
      keysToDelete.add(`loyalty:otp:${effectiveTargetTenant}:${phoneVariant}`);
      keysToDelete.add(`otp_verified_phone:${effectiveTargetTenant}:${phoneVariant}`);
    }
    for (const key of keysToDelete) {
      await deleteKvWithRetry(key);
    }
  }

  return kvCleanupErrors.length > 0
    ? {
        ok: true,
        customerId: input.customerId,
        erasedToken,
        kvCleanupFailed: true,
        kvCleanupErrors,
      }
    : { ok: true, customerId: input.customerId, erasedToken };
}
