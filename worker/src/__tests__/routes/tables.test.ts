import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tablesRouter, qrRouter, type CafeTable, type QrCodeRow } from '../../routes/tables';
import { signQRUrl, verifyQRSignature, WINDOW_SECONDS } from '../../tree/qr/signer';
import { createMockEnv, createMockContext } from '../test-utils';

const VALID_SECRET = 'qr-signing-secret-2026';

const SAMPLE_TABLES: any[] = [
  { id: '1', table_number: 'T01', zone: 'indoor', capacity: 4, status: 'Available' },
  { id: '2', table_number: 'T02', zone: 'outdoor', capacity: 6, status: 'Occupied' }
];
const SAMPLE_QR_ROWS: any[] = [
  { table_id: 1, slug: 't01' },
  { table_id: 2, slug: 't02' }
];

function buildDb(tables: any[] = [], qrRows: any[] = [], qrRow: any = null, tableRow: any = null): any {
  return {
    prepare: (sql: string) => {
      const stmt: any = {
        bind() {
          return stmt;
        },
        raw: async() => [],
        run: async() => ({ success: true, changes: 1 }),
        first: async() => {
          if (sql.includes('table_qr_codes') && sql.includes('WHERE slug')) {
            return qrRow?.row ?? null;
          }
          if (sql.includes('cafe_tables') && sql.includes('WHERE id')) {
            return tableRow?.row ?? null;
          }
          return null;
        },
        all: async() => {
          if (sql.includes('cafe_tables')) {
            return { results: tables, success: true };
          }
          if (sql.includes('table_qr_codes')) {
            return { results: qrRows, success: true };
          }
          return { results: [], success: true };
        }
      };
      return stmt;
    },
    batch: async() => [],
    exec: async() => ({ count: 0, duration: 0 }),
    dump: async() => new Uint8Array()
  };
}

function execTables(path: string, db: any, extra: any = {}, method = 'GET'): Promise<Response> {
  const env = { ...createMockEnv(), AURA_DB: db, ...extra };
  const ctx = createMockContext();
  return (tablesRouter.fetch(new Request(`https://test.aura${path}`, { method }), env as any, ctx as any)) as unknown as Promise<Response>;
}

function execQR(path: string, db: any, extra: any = {}): Promise<Response> {
  const env = { ...createMockEnv(), AURA_DB: db, ...extra };
  const ctx = createMockContext();
  return (qrRouter.fetch(new Request(`https://test.aura${path}`), env as any, ctx as any)) as unknown as Promise<Response>;
}

function signedSig(slug: string): string {
  return signQRUrl(slug, VALID_SECRET, 'https://app.test').split('sig=')[1]!.split('&')[0];
}

describe('tables — GET /', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('200 + data + qr_code_url per table', async() => {
    const db = buildDb(SAMPLE_TABLES, SAMPLE_QR_ROWS);
    const res = await execTables('?zone=indoor', db, { QR_SIGNING_SECRET: VALID_SECRET });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    body.data.forEach((t: any) => {
      expect(t.qr_code_url).toBeDefined();
      expect(typeof t.qr_code_url).toBe('string');
      expect(t.qr_code_url).toContain('/api/qr/');
    });
  });

  it('200 + empty array when no tables', async() => {
    const db = buildDb([]);
    const res = await execTables('/', db, { QR_SIGNING_SECRET: VALID_SECRET });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: [] });
  });
});

describe('tables — GET /:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('200 for existing table', async() => {
    const db = buildDb(SAMPLE_TABLES, [], null, { row: SAMPLE_TABLES[0] });
    const res = await execTables('/1', db);
    expect(res.status).toBe(200);
  });

  it('404 for missing table', async() => {
    const db = buildDb(SAMPLE_TABLES, [], null, { row: null });
    const res = await execTables('/999', db);
    expect(res.status).toBe(404);
  });
});

describe('tables — PATCH /:id/occupy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('200 when table exists', async() => {
    const db = buildDb(SAMPLE_TABLES, [], null, { row: SAMPLE_TABLES[0] });
    const res = await execTables('/1/occupy', db, {}, 'PATCH');
    expect(res.status).toBe(200);
  });

  it('404 for missing table', async() => {
    const db = buildDb(SAMPLE_TABLES, [], null, { row: null });
    const res = await execTables('/999/occupy', db, {}, 'PATCH');
    expect(res.status).toBe(404);
  });
});

describe('tables — PATCH /:id/release', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('200 when table exists', async() => {
    const db = buildDb(SAMPLE_TABLES, [], null, { row: SAMPLE_TABLES[0] });
    const res = await execTables('/1/release', db, {}, 'PATCH');
    expect(res.status).toBe(200);
  });

  it('404 for missing table', async() => {
    const db = buildDb(SAMPLE_TABLES, [], null, { row: null });
    const res = await execTables('/999/release', db, {}, 'PATCH');
    expect(res.status).toBe(404);
  });
});

describe('QR signer', () => {
  describe('signQRUrl', () => {
    it('includes ts and sig in URL', () => {
      const url = signQRUrl('t01', 'mysecret', 'https://app.example.com');
      expect(url).toContain('/api/qr/t01?');
      expect(url).toContain('ts=');
      expect(url).toContain('sig=');
    });
  });

  describe('verifyQRSignature', () => {
    const SECRET = 'test-secret-key';

    it('true for valid roundtrip', () => {
      const url = signQRUrl('table-5', SECRET, 'https://app.test');
      const u = new URL(url);
      const ts = parseInt(u.searchParams.get('ts')!, 10);
      const sig = u.searchParams.get('sig')!;
      expect(verifyQRSignature('table-5', ts, sig, SECRET)).toBe(true);
    });

    it('false for tampered sig', () => {
      const url = signQRUrl('table-5', SECRET, 'https://app.test');
      const u = new URL(url);
      const ts = parseInt(u.searchParams.get('ts')!, 10);
      const sig = u.searchParams.get('sig')!;
      expect(verifyQRSignature('table-5', ts, `${sig.slice(0, -3)}xxx`, SECRET)).toBe(false);
    });

    it('false for expired ts', () => {
      const pastTs = Math.floor(Date.now() / 1000) - WINDOW_SECONDS - 10;
      const fromUrl = new URL(signQRUrl('x', SECRET, 'https://x'));
      expect(verifyQRSignature('x', pastTs, fromUrl.searchParams.get('sig')!, SECRET)).toBe(false);
    });
  });
});

describe('QR image endpoint — GET /:slug on qrRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TABLE_ROW = { id: '1', table_number: 'T01', status: 'Available' };

  function buildQRDb(found = true): any {
    return buildDb(
      [],
      [],
      found ? { row: { table_id: 1, slug: 't01' } } : { row: null },
      found ? { row: TABLE_ROW } : undefined
    );
  }

  it('valid sig → 200 image/png', async() => {
    const ts = Math.floor(Date.now() / 1000);
    const res = await execQR(`/t01?ts=${ts}&sig=${signedSig('t01')}`, buildQRDb(true), { QR_SIGNING_SECRET: VALID_SECRET });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
  });

  it('expired ts → 401', async() => {
    const pastTs = Math.floor(Date.now() / 1000) - WINDOW_SECONDS - 10;
    const res = await execQR(`/t01?ts=${pastTs}&sig=${signedSig('t01')}`, buildQRDb(true), { QR_SIGNING_SECRET: VALID_SECRET });
    expect(res.status).toBe(401);
  });

  it('wrong sig → 401', async() => {
    const res = await execQR('/t01?ts=9999999999&sig=invalid', buildQRDb(true), { QR_SIGNING_SECRET: VALID_SECRET });
    expect(res.status).toBe(401);
  });

  it('unknown slug → 404', async() => {
    const ts = Math.floor(Date.now() / 1000);
    const res = await execQR(`/nonexistent?ts=${ts}&sig=${signedSig('nonexistent')}`, buildQRDb(false), { QR_SIGNING_SECRET: VALID_SECRET });
    expect(res.status).toBe(404);
  });
});
