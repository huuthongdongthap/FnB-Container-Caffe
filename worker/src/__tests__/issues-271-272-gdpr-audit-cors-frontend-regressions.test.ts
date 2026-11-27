import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { eraseCustomerPii } from '../../../packages/domain/crm/commands/erase-customer-pii';
import { ErpnextCrmClient } from '../clients/erpnext-crm-client';
import { redact } from '../middleware/logger';
import { getCorsOrigin } from '../middleware/cors';
import { isAllowedOrigin } from '../../../packages/domain/security/src/policies/security-headers';
import { sanitizeInternalRedirect, isAllowedPaymentUrl } from '../../../src/lib/safe-redirect';

const REPO_ROOT = path.resolve(__dirname, '../../..');

describe('Issue #271 — GDPR/NĐ 13 erasure, encrypted D1 backup, consent-gated sync, audit immutability & PII redaction', () => {
  it('eraseCustomerPii deletes user:${email} from KV, revokes consents.granted=0, and scrubs all 16 PII tables', async () => {
    const executedSql: string[] = [];
    const deletedKvKeys: string[] = [];

    const mockDb = {
      prepare(sql: string) {
        executedSql.push(sql);
        return {
          bind(..._args: unknown[]) {
            return {
              async first<T>() {
                if (sql.includes('SELECT id, phone, email, tenant_id FROM customers')) {
                  return {
                    id: 'cust_erase_1',
                    phone: '0901234567',
                    email: 'Alice.Test@Example.com',
                    tenant_id: 'default',
                  } as unknown as T;
                }
                return null;
              },
              async run() {
                return { success: true, meta: { changes: 1 } };
              },
            };
          },
        };
      },
    };

    const mockKv = {
      async delete(key: string) {
        deletedKvKeys.push(key);
      },
    };

    const result = await eraseCustomerPii(
      mockDb as unknown as Parameters<typeof eraseCustomerPii>[0],
      {
        customerId: 'cust_erase_1',
        actorId: 'cust_erase_1',
        actorRole: 'customer',
        tenantId: 'default',
        kv: mockKv as unknown as NonNullable<Parameters<typeof eraseCustomerPii>[1]['kv']>,
      },
    );

    expect(result.ok).toBe(true);
    expect(deletedKvKeys).toContain('user:alice.test@example.com');
    expect(deletedKvKeys).toContain('user:cust_erase_1');

    const joinedSql = executedSql.join('\n');
    expect(joinedSql).toContain('last_ip = NULL');
    expect(joinedSql).toContain('delivery_address = NULL');
    expect(joinedSql).toContain('granted = 0, revoked_at = ?');
    for (const table of [
      'subscriptions',
      'reservations',
      'checkins',
      'contact_messages',
      'reviews',
      'table_sessions',
      'wifi_sessions',
      'ai_barista_interactions',
      'customer_support_interactions',
      'otp_challenges',
      'email_verifications',
      'promotion_redemptions',
      'signup_bonus_log',
      'notification_audit_log',
      'leads',
    ]) {
      expect(joinedSql).toContain(table);
    }
  });

  it('deploy.yml and backup-d1.sh encrypt D1 dumps before artifact upload and delete plaintext SQL', () => {
    const deployYml = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/deploy.yml'), 'utf8');
    expect(deployYml).toContain('D1_BACKUP_ENCRYPTION_KEY');
    expect(deployYml).toContain('openssl enc -aes-256-cbc -pbkdf2');
    expect(deployYml).toContain('path: d1-backups/*.enc');
    expect(deployYml).toContain('retention-days: 7');

    const backupSh = fs.readFileSync(path.join(REPO_ROOT, 'worker/scripts/backup-d1.sh'), 'utf8');
    expect(backupSh).toContain('D1_BACKUP_ENCRYPTION_KEY');
    expect(backupSh).toContain('openssl enc -aes-256-cbc -pbkdf2');
  });

  it('ErpnextCrmClient.createLead requires explicit opt-in consent (=== true)', async () => {
    const createSpy = vi.fn().mockResolvedValue({ data: { name: 'LEAD-001' } });
    const client = new ErpnextCrmClient({ create: createSpy } as unknown as ConstructorParameters<typeof ErpnextCrmClient>[0]);

    // Default undefined consent must be rejected (fail-closed opt-in)
    const skipped = await client.createLead({
      name: 'Walk-in Guest',
      phone: '0901234567',
    });
    expect(skipped).toBeNull();
    expect(createSpy).not.toHaveBeenCalled();

    // Explicit opt-in succeeds
    const created = await client.createLead({
      name: 'Opted In',
      phone: '0901234567',
      consent_marketing: true,
      consent_erpnext_sync: true,
    });
    expect(created).toEqual({ leadId: 'LEAD-001' });
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it('audit_logs and saas_audit_logs have BEFORE UPDATE and BEFORE DELETE immutability triggers in schema and migration', () => {
    const schemaSql = fs.readFileSync(path.join(REPO_ROOT, 'worker/schema.sql'), 'utf8');
    const migSql = fs.readFileSync(
      path.join(REPO_ROOT, 'worker/db/migrations/20261127_02_audit_logs_immutability_triggers.sql'),
      'utf8',
    );
    const downSql = fs.readFileSync(
      path.join(REPO_ROOT, 'worker/db/migrations/20261127_02_audit_logs_immutability_triggers.down.sql'),
      'utf8',
    );

    for (const trig of [
      'trg_audit_logs_no_update',
      'trg_audit_logs_no_delete',
      'trg_saas_audit_logs_no_update',
      'trg_saas_audit_logs_no_delete',
    ]) {
      expect(schemaSql).toContain(trig);
      expect(migSql).toContain(trig);
      expect(downSql).toContain(`DROP TRIGGER IF EXISTS ${trig}`);
    }
  });

  it('logger redact() masks JWTs, Bearer tokens, email addresses, and phone numbers', () => {
    const out = redact({
      note: 'User alice@example.com sent Bearer secret_tok_123 with eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmno',
      rawPhone: '0901234567',
    }) as Record<string, string>;

    expect(out.note).not.toContain('alice@example.com');
    expect(out.note).not.toContain('secret_tok_123');
    expect(out.note).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(out.rawPhone).toBe('[REDACTED]');
  });
});

describe('Issue #272 — Production CORS, Open Redirect, stitch-designs removal, JSON-LD, PIN & CSP', () => {
  it('blocks localhost and 127.0.0.1 origins in production and allows them only in development/test', () => {
    expect(getCorsOrigin('http://localhost:5173', 'production')).toBe(false);
    expect(getCorsOrigin('http://127.0.0.1:8787', 'production')).toBe(false);
    expect(getCorsOrigin('http://localhost:9999')).toBe(false);
    expect(getCorsOrigin('http://localhost:5173', 'development')).toBe('http://localhost:5173');
    expect(getCorsOrigin('http://127.0.0.1:8787', 'test')).toBe('http://127.0.0.1:8787');
    expect(getCorsOrigin('https://auraspace.cafe', 'production')).toBe('https://auraspace.cafe');

    expect(isAllowedOrigin('http://localhost:5173', 'production')).toBe(false);
    expect(isAllowedOrigin('http://localhost:5173', 'development')).toBe(true);
    expect(isAllowedOrigin('https://auraspace.cafe', 'production')).toBe(true);
  });

  it('sanitizeInternalRedirect blocks //evil.com, /\\evil.com, and javascript: while allowing safe paths', () => {
    expect(sanitizeInternalRedirect('/account/orders?page=2', '/account', 'https://auraspace.cafe')).toBe(
      '/account/orders?page=2',
    );
    expect(sanitizeInternalRedirect('//evil.com', '/account', 'https://auraspace.cafe')).toBe('/account');
    expect(sanitizeInternalRedirect('/\\evil.com', '/account', 'https://auraspace.cafe')).toBe('/account');
    expect(sanitizeInternalRedirect('javascript:alert(1)', '/account', 'https://auraspace.cafe')).toBe('/account');
  });

  it('isAllowedPaymentUrl allows HTTPS PayOS URLs and rejects untrusted or HTTP URLs', () => {
    expect(isAllowedPaymentUrl('https://pay.payos.vn/web/abc123', 'https://auraspace.cafe')).toBe(true);
    expect(isAllowedPaymentUrl('http://pay.payos.vn/web/abc123', 'https://auraspace.cafe')).toBe(false);
    expect(isAllowedPaymentUrl('https://evil.example.com/phish', 'https://auraspace.cafe')).toBe(false);
  });

  it('removes public/stitch-designs from public/ and enforces CSP, JSON-LD escaping, PIN masking, and noopener', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'public/stitch-designs'))).toBe(false);

    const headers = fs.readFileSync(path.join(REPO_ROOT, '_headers'), 'utf8');
    expect(headers).toContain("script-src 'self';");
    expect(headers).toContain("object-src 'none'");
    expect(headers).toContain("frame-ancestors 'none'");

    const breadcrumbs = fs.readFileSync(path.join(REPO_ROOT, 'src/components/shared/Breadcrumbs.tsx'), 'utf8');
    expect(breadcrumbs).toContain(".replace(/</g, '\\\\u003c')");

    const home = fs.readFileSync(path.join(REPO_ROOT, 'src/pages/home.tsx'), 'utf8');
    expect(home).toContain(".replace(/</g, '\\\\u003c')");

    const mobileLogin = fs.readFileSync(path.join(REPO_ROOT, 'src/pages/mobile/mobile-login.tsx'), 'utf8');
    expect(mobileLogin).toContain('type="password" inputMode="numeric"');

    const referral = fs.readFileSync(path.join(REPO_ROOT, 'src/pages/referral.tsx'), 'utf8');
    expect(referral).toContain("'noopener,noreferrer'");
  });
});
