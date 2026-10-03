/**
 * OpenWISP WiFi Captive Portal Session Management (tree layer)
 */

import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'wifi-session' });

export interface WifiSessionRecord {
  id: string;
  client_mac: string;
  ip_address: string | null;
  phone: string | null;
  customer_id: string | null;
  status: string;
  session_timeout: number;
  authorized_at: string;
  expires_at: string;
  created_at: string;
}

export function normalizeMac(mac: string): string {
  const cleaned = mac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (cleaned.length !== 12) {
    return mac.toUpperCase();
  }
  return cleaned.match(/.{1,2}/g)!.join(':');
}

export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length === 11) {
    cleaned = '0' + cleaned.slice(2);
  }
  return cleaned;
}

export function isValidPhone(phone: string): boolean {
  return /^(0[35789])[0-9]{8}$/.test(phone);
}

export async function checkWifiSessionStatus(
  env: Record<string, unknown>,
  mac: string
): Promise<{ authorized: boolean; remaining_seconds: number; session?: Partial<WifiSessionRecord> }> {
  const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database | undefined;
  if (!db) {
    throw new Error('D1 database binding missing');
  }

  const normalizedMac = normalizeMac(mac);
  const now = new Date().toISOString();

  const session = await db
    .prepare(
      `SELECT id, client_mac, ip_address, phone, customer_id, status, session_timeout, authorized_at, expires_at, created_at
       FROM wifi_sessions
       WHERE client_mac = ? AND status = 'authorized' AND expires_at > ?
       ORDER BY expires_at DESC
       LIMIT 1`
    )
    .bind(normalizedMac, now)
    .first<WifiSessionRecord>();

  if (!session) {
    return { authorized: false, remaining_seconds: 0 };
  }

  const expiresTime = new Date(session.expires_at).getTime();
  const remainingSeconds = Math.max(0, Math.floor((expiresTime - Date.now()) / 1000));

  return {
    authorized: true,
    remaining_seconds: remainingSeconds,
    session: {
      id: session.id,
      client_mac: session.client_mac,
      phone: session.phone,
      authorized_at: session.authorized_at,
      expires_at: session.expires_at
    }
  };
}

export async function loginWifiGuest(
  env: Record<string, unknown>,
  data: { mac: string; phone: string; name?: string; ip_address?: string; duration_seconds?: number }
): Promise<{
  success: boolean;
  authorized: boolean;
  session_id: string;
  customer_id: string;
  redirect_url: string;
  remaining_seconds: number;
}> {
  const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database | undefined;
  if (!db) {
    throw new Error('D1 database binding missing');
  }

  const normalizedMac = normalizeMac(data.mac);
  const normalizedPhone = normalizePhone(data.phone);

  if (!isValidPhone(normalizedPhone)) {
    throw new Error('Invalid Vietnamese phone number format');
  }

  const timeoutSeconds = data.duration_seconds && data.duration_seconds > 0 ? data.duration_seconds : 3600;
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresIso = new Date(now.getTime() + timeoutSeconds * 1000).toISOString();

  // 1. Tag or create customer in customers table
  let customer = await db
    .prepare('SELECT id, phone, name FROM customers WHERE phone = ? LIMIT 1')
    .bind(normalizedPhone)
    .first<{ id: string; phone: string; name: string }>();

  let customerId: string;
  if (customer) {
    customerId = customer.id;
    // Customer found: Ensure tagged as wifi_user or update profile
    try {
      await db
        .prepare('UPDATE customers SET updated_at = ? WHERE id = ?')
        .bind(nowIso, customerId)
        .run();
    } catch { /* best effort */ }
  } else {
    // Create new customer with source 'wifi_portal'
    customerId = `CUS_WIFI_${crypto.randomUUID().slice(0, 8)}`;
    const email = `${normalizedPhone}@wifi.aura`;
    const name = data.name?.trim() || 'Khách WiFi';
    try {
      await db
        .prepare(
          `INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, 0, 'BRONZE', 'wifi_portal', ?, ?)`
        )
        .bind(customerId, email, name, normalizedPhone, nowIso, nowIso)
        .run();
    } catch {
      // In case customers schema differs slightly
      try {
        await db
          .prepare(
            `INSERT INTO customers (id, email, name, phone, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(customerId, email, name, normalizedPhone, nowIso, nowIso)
          .run();
      } catch (err) {
        log.warn('customer_create_fallback_failed', { error: (err as Error).message });
      }
    }
  }

  // 2. Insert or replace session in wifi_sessions
  const sessionId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO wifi_sessions
       (id, client_mac, ip_address, phone, customer_id, status, session_timeout, authorized_at, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, 'authorized', ?, ?, ?, ?)`
    )
    .bind(
      sessionId,
      normalizedMac,
      data.ip_address ?? null,
      normalizedPhone,
      customerId,
      timeoutSeconds,
      nowIso,
      expiresIso,
      nowIso
    )
    .run();

  log.info('wifi_guest_authorized', { mac: normalizedMac, phone: normalizedPhone, customerId, sessionId });

  return {
    success: true,
    authorized: true,
    session_id: sessionId,
    customer_id: customerId,
    redirect_url: 'https://auracafe.vn/menu',
    remaining_seconds: timeoutSeconds
  };
}

export async function authorizeWifiOverride(
  env: Record<string, unknown>,
  data: { mac: string; action: 'grant' | 'revoke'; duration_seconds?: number; notes?: string }
): Promise<{ success: boolean; mac: string; action: string }> {
  const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database | undefined;
  if (!db) {
    throw new Error('D1 database binding missing');
  }

  const normalizedMac = normalizeMac(data.mac);
  const now = new Date();
  const nowIso = now.toISOString();

  if (data.action === 'revoke') {
    await db
      .prepare('UPDATE wifi_sessions SET status = "revoked", expires_at = ? WHERE client_mac = ?')
      .bind(nowIso, normalizedMac)
      .run();

    log.info('wifi_session_revoked', { mac: normalizedMac });
    return { success: true, mac: normalizedMac, action: 'revoked' };
  }

  const timeoutSeconds = data.duration_seconds && data.duration_seconds > 0 ? data.duration_seconds : 7200;
  const expiresIso = new Date(now.getTime() + timeoutSeconds * 1000).toISOString();
  const sessionId = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO wifi_sessions
       (id, client_mac, ip_address, phone, customer_id, status, session_timeout, authorized_at, expires_at, created_at)
       VALUES (?, ?, NULL, NULL, NULL, 'authorized', ?, ?, ?, ?)`
    )
    .bind(sessionId, normalizedMac, timeoutSeconds, nowIso, expiresIso, nowIso)
    .run();

  log.info('wifi_session_manually_granted', { mac: normalizedMac, timeoutSeconds });
  return { success: true, mac: normalizedMac, action: 'granted' };
}
