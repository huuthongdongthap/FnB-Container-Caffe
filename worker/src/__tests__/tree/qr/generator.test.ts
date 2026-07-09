import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSlug, bulkGenerateSlugs, generateDataURL, generatePNG } from '../../../tree/qr/generator';

describe('generateSlug', () => {
  it('T01 indoor → t01-indoor', () => {
    expect(generateSlug('T01', 'indoor')).toBe('t01-indoor');
  });

  it('VIP01 private-room → vip01-private-room', () => {
    expect(generateSlug('VIP01', 'private-room')).toBe('vip01-private-room');
  });
});

describe('bulkGenerateSlugs', () => {
  const tables = [
    { id: '1', table_number: 'T01', zone: 'indoor', capacity: 4, status: 'Available' },
    { id: '2', table_number: 'T02', zone: 'outdoor', capacity: 6, status: 'Available' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts slugs for tables missing them', async() => {
    const inserted: Record<number, string> = {};
    const db: any = {
      prepare: (sql: string) => {
        const isSelectExisting = sql.includes('WHERE table_id = ?');
        const isUpsert = sql.includes('INSERT INTO table_qr_codes');
        return {
          bind: (...args: any[]) => {
            if (isSelectExisting && args[0] != null) {
              const slug = inserted[Number(args[0])];
              return { first: async() => (slug ? { table_id: args[0], slug } : null) };
            }
            if (isUpsert) {
              const [idNum, slug] = args;
              inserted[Number(idNum)] = slug;
              return { run: async() => ({ count: 1 }) };
            }
            return { first: async() => null, all: async() => ({ results: [] }), run: async() => ({ count: 1 }) };
          }
        };
      }
    };

    const result = await bulkGenerateSlugs(db, tables as any);
    expect(result.get(1)).toBe('t01-indoor');
    expect(result.get(2)).toBe('t02-outdoor');
  });

  it('preserves pre-existing slug, generates new for missing table', async() => {
    const existingSlug = 'quick-bar-t01';
    const inserted: Record<number, string> = { 1: existingSlug };

    const db: any = {
      prepare: (sql: string) => {
        const isSelectExisting = sql.includes('WHERE table_id = ?');
        const isUpsert = sql.includes('INSERT INTO table_qr_codes');
        return {
          bind: (...args: any[]) => {
            if (isSelectExisting && args[0] != null) {
              const sid = Number(args[0]);
              const slug = inserted[sid];
              return { first: async() => (slug ? { table_id: sid, slug } : null) };
            }
            if (isUpsert) {
              const [idNum, slug] = args;
              inserted[Number(idNum)] = slug;
              return { run: async() => ({ count: 1 }) };
            }
            return { first: async() => null, all: async() => ({ results: [] }), run: async() => ({ count: 1 }) };
          }
        };
      }
    };

    const result2 = await bulkGenerateSlugs(db, tables as any);
    expect(result2.get(1)).toBe(existingSlug); // preserved
    expect(result2.get(2)).toBe('t02-outdoor'); // generated fresh
  });
});

describe('generatePNG / generateDataURL', () => {
  it('generatePNG returns non-empty Uint8Array', async() => {
    const buf = await generatePNG('t01-indoor', 'https://app.test');
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it('generateDataURL returns base64 data URL', async() => {
    const url = await generateDataURL('t01-indoor', 'https://app.test');
    expect(url).toMatch(/^data:image\/png;base64,/);
  });
});
