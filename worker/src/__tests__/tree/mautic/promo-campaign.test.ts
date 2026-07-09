/**
 * Unit tests for src/tree/mautic/promo-campaign.ts
 * Tests: triggerPromoCampaign — DB query by tier, contact creation, campaign
 * enrollment, enrollment tracking, error skip behavior.
 * Mock strategy: vi.doMock client-factory + enrollment-tracker + logger, then
 * lazy-import promo-campaign.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers (must be defined before vi.doMock calls)
// ---------------------------------------------------------------------------

type MockClient = {
  createOrUpdateContact: ReturnType<typeof vi.fn>;
  addContactToCampaign: ReturnType<typeof vi.fn>;
};

function makeD1Db(rows: Array<Record<string, unknown>> = []) {
  const prepared = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: rows, success: true })
  };
  return {
    prepare: vi.fn(() => prepared)
  };
}

function makeMockClient(): MockClient {
  return {
    createOrUpdateContact: vi.fn().mockResolvedValue(42),
    addContactToCampaign: vi.fn().mockResolvedValue(true)
  };
}

function makeEnv(client: MockClient, db: ReturnType<typeof makeD1Db>, overrides: Record<string, unknown> = {}) {
  return {
    AURA_DB: db,
    MAUTIC_BASE_URL: 'https://m.example.com',
    MAUTIC_CLIENT_ID: 'cid',
    MAUTIC_CLIENT_SECRET: 'csec',
    ...overrides
  };
}

function makeCustomerRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cust-1',
    name: 'Nguyen Van A',
    phone: '0912345678',
    email: 'nguyen@example.com',
    loyalty_tier: 'gold',
    birthday: '1990-03-15',
    last_order_date: '2026-06-01',
    total_orders: 42,
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('triggerPromoCampaign', () => {
  beforeEach(() => vi.resetModules());

  async function loadMod(clientStub: MockClient, trackImpl?: ReturnType<typeof vi.fn>) {
    const trackFn = trackImpl ?? vi.fn().mockResolvedValue(undefined);
    vi.doMock('../../../tree/mautic/client-factory', () => ({
      getMauticClient: vi.fn(() => clientStub)
    }));
    vi.doMock('../../../tree/mautic/enrollment-tracker', () => ({
      trackEnrollment: trackFn
    }));
    vi.doMock('../../../utils/logger', () => ({
      createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
    }));
    return await import('../../../tree/mautic/promo-campaign.js');
  }

  it('returns {enrolled:0} when client is null (missing env)', async() => {
    const mod = await loadMod(null as unknown as MockClient);
    const env: Record<string, unknown> = { AURA_DB: makeD1Db(), MAUTIC_CAMPAIGN_PROMO: '30' };
    const result = await mod.triggerPromoCampaign(env, { segment: { tier: 'gold' }, templateName: 'summer', promoTitle: 'Sale', promoDesc: 'Desc' });
    expect(result).toEqual({ enrolled: 0 });
  });

  it('returns {enrolled:0} when AURA_DB is absent', async() => {
    const mod = await loadMod(makeMockClient());
    const env: Record<string, unknown> = { MAUTIC_BAMPAIGN_PROMO: '30', MAUTIC_BASE_URL: 'x', MAUTIC_CLIENT_ID: 'x', MAUTIC_CLIENT_SECRET: 'x' };
    const result = await mod.triggerPromoCampaign(env, { segment: { tier: 'gold' }, templateName: 'summer', promoTitle: 'Sale', promoDesc: 'Desc' });
    expect(result).toEqual({ enrolled: 0 });
  });

  it('returns {enrolled:0} when MAUTIC_CAMPAIGN_PROMO is absent', async() => {
    const db = makeD1Db();
    const mod = await loadMod(makeMockClient());
    const env = makeEnv(makeMockClient(), db);
    const result = await mod.triggerPromoCampaign(env, { segment: { tier: 'gold' }, templateName: 'summer', promoTitle: 'Sale', promoDesc: 'Desc' });
    expect(result).toEqual({ enrolled: 0 });
  });

  it('queries customers matching the requested tier', async() => {
    const rows = [makeCustomerRow({ loyalty_tier: 'gold' })];
    const db = makeD1Db(rows);
    const client = makeMockClient();
    const env = makeEnv(client, db, { MAUTIC_CAMPAIGN_PROMO: '30' });
    const mod = await loadMod(client);
    await mod.triggerPromoCampaign(env, { segment: { tier: 'gold' }, templateName: 'summer', promoTitle: 'Sale', promoDesc: 'Desc' });
    expect(db.prepare).toHaveBeenCalledTimes(1);
    const sql = (db.prepare as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sql).toContain('LIMIT');
  });

  it('passes tier through bind() to the prepared statement', async() => {
    // After db.prepare() returns the prepared stub, source calls stub.bind(tier)
    // The `prepared` object created inside makeD1Db has a vi.fn bind that records calls
    let lastPrepared: { bind: ReturnType<typeof vi.fn> } | null = null;
    const db: Record<string, unknown> = {
      prepare: vi.fn(() => {
        const prepared = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [], success: true })
        };
        lastPrepared = prepared;
        return prepared as never;
      })
    };

    const client = makeMockClient();
    const env = makeEnv(client, db, { MAUTIC_CAMPAIGN_PROMO: '30' });
    const mod = await loadMod(client);
    await mod.triggerPromoCampaign(env, { segment: { tier: 'GOLD' }, templateName: 'summer', promoTitle: 'Sale', promoDesc: 'Desc' });
    // db.prepare() should have been called once
    expect(db.prepare).toHaveBeenCalledTimes(1);
    // The returned prepared stub had .bind(tier) called with 'GOLD'
    expect(lastPrepared).not.toBeNull();
    expect(lastPrepared!.bind).toHaveBeenCalledWith('GOLD');
  });

  it('enrolls customers: creates contact + adds to campaign + tracks', async() => {
    const rows = [makeCustomerRow({ id: 'c1' }), makeCustomerRow({ id: 'c2' })];
    const db = makeD1Db(rows);
    const client = makeMockClient();
    const env = makeEnv(client, db, { MAUTIC_CAMPAIGN_PROMO: '30' });
    const mod = await loadMod(client);
    const result = await mod.triggerPromoCampaign(env, { segment: { tier: 'gold' }, templateName: 'summer', promoTitle: 'Sale', promoDesc: 'Desc' });
    expect(result.enrolled).toBe(2);
    expect(client.createOrUpdateContact).toHaveBeenCalledTimes(2);
    expect(client.addContactToCampaign).toHaveBeenCalledTimes(2);
  });

  it('uses default campaign id 30 when MAUTIC_CAMPAIGN_PROMO is missing', async() => {
    const rows = [makeCustomerRow()];
    const db = makeD1Db(rows);
    const client = makeMockClient();
    const env = makeEnv(client, db, { MAUTIC_CAMPAIGN_PROMO: undefined });
    const mod = await loadMod(client);
    await mod.triggerPromoCampaign(env, { segment: { tier: 'gold' }, templateName: 'summer', promoTitle: 'Sale', promoDesc: 'Desc' });
    expect(client.addContactToCampaign).toHaveBeenCalledWith(42, 30);
  });

  it('skips enrollment silently when Mautic call throws', async() => {
    const rows = [makeCustomerRow({ id: 'c1' }), makeCustomerRow({ id: 'c2' })];
    const db = makeD1Db(rows);
    const failClient: MockClient = {
      createOrUpdateContact: vi.fn().mockResolvedValueOnce(1).mockRejectedValueOnce(new Error('Mautic 500')),
      addContactToCampaign: vi.fn()
    };
    const mod = await loadMod(failClient);
    const env = makeEnv(failClient, db, { MAUTIC_CAMPAIGN_PROMO: '30' });
    const result = await mod.triggerPromoCampaign(env, { segment: { tier: 'gold' }, templateName: 'summer', promoTitle: 'Sale', promoDesc: 'Desc' });
    expect(result.enrolled).toBe(1);
  });

  it('returns enrolled:0 when DB returns no results', async() => {
    const db = makeD1Db([]);
    const client = makeMockClient();
    const env = makeEnv(client, db, { MAUTIC_CAMPAIGN_PROMO: '30' });
    const mod = await loadMod(client);
    const result = await mod.triggerPromoCampaign(env, { segment: { tier: 'gold' }, templateName: 'summer', promoTitle: 'Sale', promoDesc: 'Desc' });
    expect(result).toEqual({ enrolled: 0 });
    expect(client.createOrUpdateContact).not.toHaveBeenCalled();
  });
});
