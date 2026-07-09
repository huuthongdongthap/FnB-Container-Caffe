/**
 * Unit tests for src/tree/mautic/types.ts
 * Tests: interface shapes, optional fields, index signature, type guards.
 * Value-of assertions only — no :any.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Import all exports explicitly (test surface = contract)
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

import type { MauticBridgeEnv } from '../../../tree/mautic/types.js';
import type { MauticClientDuck } from '../../../tree/mautic/types.js';
import type { CustomerContact } from '../../../tree/mautic/types.js';
import type { SyncContactsResponse } from '../../../tree/mautic/types.js';
import type { SyncStatus } from '../../../tree/mautic/types.js';

// ---------------------------------------------------------------------------
// Runtime introspection helpers
// ---------------------------------------------------------------------------

function hasKey(obj: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function describeProps(
  actual: object,
  expectedKeys: PropertyKey[]
): { missing: PropertyKey[]; extra: string[]; allPresent: boolean } {
  const missing = expectedKeys.filter((k) => !hasKey(actual, k));
  const extra = Object.keys(actual).filter((k) => !expectedKeys.includes(k as PropertyKey));
  return { missing, extra, allPresent: missing.length === 0 };
}

// ---------------------------------------------------------------------------
// MauticBridgeEnv
// ---------------------------------------------------------------------------

describe('MauticBridgeEnv', () => {
  it('accepts all required fields', () => {
    const env: Partial<MauticBridgeEnv> & {
      AURA_DB: never;
      MAUTIC_BASE_URL: string;
      MAUTIC_CLIENT_ID: string;
      MAUTIC_CLIENT_SECRET: string;
    } = {
      AURA_DB: {} as never,
      MAUTIC_BASE_URL: 'https://m.example.com',
      MAUTIC_CLIENT_ID: 'cid',
      MAUTIC_CLIENT_SECRET: 'csec'
    };
    expect(env.MAUTIC_BASE_URL).toBe('https://m.example.com');
    expect(env.MAUTIC_CLIENT_ID).toBe('cid');
    expect(env.MAUTIC_CLIENT_SECRET).toBe('csec');
  });

  it('accepts all campaign env vars', () => {
    const env: Partial<MauticBridgeEnv> & {
      AURA_DB: never;
      MAUTIC_BASE_URL: string;
      MAUTIC_CLIENT_ID: string;
      MAUTIC_CLIENT_SECRET: string;
    } = {
      AURA_DB: {} as never,
      MAUTIC_BASE_URL: 'https://m.example.com',
      MAUTIC_CLIENT_ID: 'cid',
      MAUTIC_CLIENT_SECRET: 'csec',
      MAUTIC_CAMPAIGN_WINBACK: '10',
      MAUTIC_CAMPAIGN_BIRTHDAY: '20',
      MAUTIC_CAMPAIGN_PROMO: '30'
    };
    expect(env.MAUTIC_CAMPAIGN_WINBACK).toBe('10');
    expect(env.MAUTIC_CAMPAIGN_BIRTHDAY).toBe('20');
    expect(env.MAUTIC_CAMPAIGN_PROMO).toBe('30');
  });

  it('[key: string]: unknown index signature accepts arbitrary keys', () => {
    const env: Partial<MauticBridgeEnv> & {
      AURA_DB: never;
      MAUTIC_BASE_URL: string;
      MAUTIC_CLIENT_ID: string;
      MAUTIC_CLIENT_SECRET: string;
    } = {
      AURA_DB: {} as never,
      MAUTIC_BASE_URL: 'https://m.example.com',
      MAUTIC_CLIENT_ID: 'cid',
      MAUTIC_CLIENT_SECRET: 'csec',
      CUSTOM_ENV_KEY: 42
    };
    expect(env.CUSTOM_ENV_KEY).toBe(42);
  });

  it('AURA_DB value type is unconstrained', () => {
    const env: Partial<MauticBridgeEnv> & {
      AURA_DB: never;
      MAUTIC_BASE_URL: string;
      MAUTIC_CLIENT_ID: string;
      MAUTIC_CLIENT_SECRET: string;
    } = {
      AURA_DB: { prepare: () => ({}) } as never,
      MAUTIC_BASE_URL: 'https://m.example.com',
      MAUTIC_CLIENT_ID: 'cid',
      MAUTIC_CLIENT_SECRET: 'csec'
    };
    expect(typeof env.AURA_DB).toBe('object');
    expect(env.AURA_DB).toBeDefined();
  });

  it('all campaign fields are optional strings', () => {
    const env: Partial<MauticBridgeEnv> = {
      MAUTIC_BASE_URL: 'https://m.example.com',
      MAUTIC_CLIENT_ID: 'cid',
      MAUTIC_CLIENT_SECRET: 'csec',
      AURA_DB: {} as never
    };
    expect((env as Partial<MauticBridgeEnv> & { MAUTIC_CAMPAIGN_WINBACK?: string }).MAUTIC_CAMPAIGN_WINBACK).toBeUndefined();
    expect((env as Partial<MauticBridgeEnv> & { MAUTIC_CAMPAIGN_BIRTHDAY?: string }).MAUTIC_CAMPAIGN_BIRTHDAY).toBeUndefined();
    expect((env as Partial<MauticBridgeEnv> & { MAUTIC_CAMPAIGN_PROMO?: string }).MAUTIC_CAMPAIGN_PROMO).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// MauticClientDuck (structural type)
// ---------------------------------------------------------------------------

describe('MauticClientDuck', () => {
  it('accepts an object with addToCampaign and syncContacts methods', () => {
    const client: MauticClientDuck = {
      addToCampaign: vi.fn().mockResolvedValue(undefined),
      syncContacts: vi.fn().mockResolvedValue({ created: [], updated: [], errors: [] })
    } as never;
    expect(typeof client.addToCampaign).toBe('function');
    expect(typeof client.syncContacts).toBe('function');
  });

  it('addToCampaign takes (email, campaignName) and returns Promise', async() => {
    const client: MauticClientDuck = {
      addToCampaign: vi.fn().mockResolvedValue(undefined),
      syncContacts: vi.fn().mockResolvedValue({ created: [], updated: [], errors: [] })
    } as never;
    const promise = client.addToCampaign('test@example.com', 'vip-master');
    expect(promise instanceof Promise).toBe(true);
    await promise;
    expect(client.addToCampaign).toHaveBeenCalledWith('test@example.com', 'vip-master');
  });

  it('syncContacts takes contacts array and returns SyncContactsResponse', async() => {
    const response: SyncContactsResponse = {
      created: [{ id: 1, email: 'a@example.com' }],
      updated: [{ id: 2, email: 'b@example.com' }],
      errors: []
    };
    const client: MauticClientDuck = {
      addToCampaign: vi.fn(),
      syncContacts: vi.fn().mockResolvedValue(response)
    } as never;
    const result = (await client.syncContacts([
      { email: 'a@example.com' },
      { email: 'b@example.com' }
    ])) as SyncContactsResponse;
    expect(result.created).toHaveLength(1);
    expect(result.updated).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// CustomerContact
// ---------------------------------------------------------------------------

describe('CustomerContact', () => {
  it('accepts all fields with correct types', () => {
    const contact: CustomerContact = {
      id: 'c-1',
      name: 'Nguyen Van A',
      phone: '0912345678',
      email: 'nguyen@example.com',
      tier: 'silver',
      total_spent: 500000,
      visit_count: 3,
      last_visit: '2026-07-01T10:00:00Z'
    };
    expect(typeof contact.id).toBe('string');
    expect(typeof contact.name).toBe('string');
    expect(typeof contact.phone).toBe('string');
    expect(typeof contact.email).toBe('string');
    expect(typeof contact.tier).toBe('string');
    expect(typeof contact.total_spent).toBe('number');
    expect(typeof contact.visit_count).toBe('number');
    expect(typeof contact.last_visit).toBe('string');
  });

  it('last_visit accepts null', () => {
    const contact: CustomerContact = {
      id: 'c-2',
      name: 'Test',
      phone: '',
      email: 'test@example.com',
      tier: 'bronze',
      total_spent: 0,
      visit_count: 0,
      last_visit: null
    };
    expect(contact.last_visit).toBeNull();
  });

  it('all string fields are non-empty in a fully populated instance', () => {
    const contact: CustomerContact = {
      id: 'c-3',
      name: 'Full Name',
      phone: '0912345678',
      email: 'full@example.com',
      tier: 'gold',
      total_spent: 1000000,
      visit_count: 5,
      last_visit: '2026-07-07T10:00:00Z'
    };
    expect(contact.id.length).toBeGreaterThan(0);
    expect(contact.name.length).toBeGreaterThan(0);
    expect(contact.email.length).toBeGreaterThan(0);
  });

  it('total_spent and visit_count are numbers not strings', () => {
    const contact: CustomerContact = {
      id: 'c-4',
      name: 'Num Test',
      phone: '',
      email: 'num@example.com',
      tier: 'basic',
      total_spent: 250000.5,
      visit_count: 10,
      last_visit: null
    };
    expect(typeof contact.total_spent).toBe('number');
    expect(typeof contact.visit_count).toBe('number');
    expect(contact.total_spent).toBe(250000.5);
    expect(contact.visit_count).toBe(10);
  });

  it('structural integrity: all required fields present across two distinct instances', () => {
    const c1: CustomerContact = {
      id: 'c-1',
      name: 'A',
      phone: 'p1',
      email: 'a@x.com',
      tier: 'bronze',
      total_spent: 0,
      visit_count: 0,
      last_visit: null
    };
    const c2: CustomerContact = {
      id: 'c-2',
      name: 'B',
      phone: '',
      email: 'b@x.com',
      tier: 'ENTERPRISE',
      total_spent: 999999,
      visit_count: 100,
      last_visit: '2026-07-07T00:00:00Z'
    };
    const expectedKeys = ['id', 'name', 'phone', 'email', 'tier', 'total_spent', 'visit_count', 'last_visit'];
    expect(describeProps(c1, expectedKeys).allPresent).toBe(true);
    expect(describeProps(c2, expectedKeys).allPresent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SyncContactsResponse
// ---------------------------------------------------------------------------

describe('SyncContactsResponse', () => {
  it('accepts a fully populated success response', () => {
    const resp: SyncContactsResponse = {
      created: [{ id: 1, email: 'new@example.com' }],
      updated: [{ id: 2, email: 'existing@example.com' }],
      errors: []
    };
    expect(resp.created).toHaveLength(1);
    expect(resp.updated).toHaveLength(1);
    expect(resp.errors).toHaveLength(0);
  });

  it('accepts an empty response', () => {
    const resp: SyncContactsResponse = {
      created: [],
      updated: [],
      errors: []
    };
    expect(resp.created).toHaveLength(0);
    expect(resp.updated).toHaveLength(0);
    expect(resp.errors).toHaveLength(0);
  });

  it('errors array items have email and error string fields', () => {
    const resp: SyncContactsResponse = {
      created: [],
      updated: [],
      errors: [
        { email: 'dup@example.com', error: 'Duplicate email address' },
        { email: 'bad@example.com', error: 'Invalid format' }
      ]
    };
    expect(typeof resp.errors[0].email).toBe('string');
    expect(typeof resp.errors[0].error).toBe('string');
    expect(resp.errors[0].email).toBe('dup@example.com');
    expect(resp.errors[0].error).toBe('Duplicate email address');
  });

  it('all array fields are typed as arrays', () => {
    const resp: SyncContactsResponse = {
      created: [],
      updated: [],
      errors: []
    };
    expect(Array.isArray(resp.created)).toBe(true);
    expect(Array.isArray(resp.updated)).toBe(true);
    expect(Array.isArray(resp.errors)).toBe(true);
  });

  it('round-trips through JSON without type mutation', () => {
    const original: SyncContactsResponse = {
      created: [{ id: 1, email: 'a@x.com' }],
      updated: [],
      errors: [{ email: 'e@x.com', error: 'err' }]
    };
    const serialized = JSON.stringify(original);
    const parsed = JSON.parse(serialized) as SyncContactsResponse;
    expect(Array.isArray(parsed.created)).toBe(true);
    expect(Array.isArray(parsed.updated)).toBe(true);
    expect(Array.isArray(parsed.errors)).toBe(true);
    expect(parsed.errors[0].email).toBe('e@x.com');
    expect(parsed.errors[0].error).toBe('err');
  });
});

// ---------------------------------------------------------------------------
// SyncStatus
// ---------------------------------------------------------------------------

describe('SyncStatus', () => {
  const validStatuses: SyncStatus['status'][] = ['idle', 'running', 'completed', 'failed'];

  it('accepts all four status enum values', () => {
    for (const s of validStatuses) {
      const status: SyncStatus['status'] = s;
      expect(status).toBe(s);
    }
  });

  it('constructs a full Status instance', () => {
    const status: SyncStatus = {
      last_sync: '2026-07-07T12:00:00Z',
      contacts_synced: 100,
      campaigns_enrolled: 10,
      errors: [{ customer_id: 'c1', error: 'err' }],
      status: 'completed'
    };
    expect(status.last_sync).toBe('2026-07-07T12:00:00Z');
    expect(status.contacts_synced).toBe(100);
    expect(status.campaigns_enrolled).toBe(10);
    expect(status.errors).toHaveLength(1);
    expect(status.status).toBe('completed');
  });

  it('last_sync accepts null (default)', () => {
    const status: SyncStatus = {
      last_sync: null,
      contacts_synced: 0,
      campaigns_enrolled: 0,
      errors: [],
      status: 'idle'
    };
    expect(status.last_sync).toBeNull();
  });

  it('last_sync is ISO string when set', () => {
    const status: SyncStatus = {
      last_sync: new Date('2026-07-07T10:30:00Z').toISOString(),
      contacts_synced: 0,
      campaigns_enrolled: 0,
      errors: [],
      status: 'running'
    };
    expect(status.last_sync).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('errors items have customer_id and error fields', () => {
    const err = { customer_id: 'batch', error: 'DB disconnected' };
    const status: SyncStatus = {
      last_sync: null,
      contacts_synced: 0,
      campaigns_enrolled: 0,
      errors: [err],
      status: 'failed'
    };
    expect(typeof status.errors[0].customer_id).toBe('string');
    expect(typeof status.errors[0].error).toBe('string');
    expect(status.errors[0].customer_id).toBe('batch');
    expect(status.errors[0].error).toBe('DB disconnected');
  });

  it('numeric fields accept 0 and positive values', () => {
    const status: SyncStatus = {
      last_sync: null,
      contacts_synced: 0,
      campaigns_enrolled: 0,
      errors: [],
      status: 'idle'
    };
    expect(status.contacts_synced).toBe(0);
    expect(status.campaigns_enrolled).toBe(0);
    status.contacts_synced = 999;
    status.campaigns_enrolled = 77;
    expect(status.contacts_synced).toBe(999);
    expect(status.campaigns_enrolled).toBe(77);
  });

  it('errors field is an array and mutable', () => {
    const status: SyncStatus = {
      last_sync: null,
      contacts_synced: 0,
      campaigns_enrolled: 0,
      errors: [],
      status: 'idle'
    };
    expect(Array.isArray(status.errors)).toBe(true);
    status.errors.push({ customer_id: 'x', error: 'y' });
    expect(status.errors).toHaveLength(1);
  });

  it('status is a discriminated union field', () => {
    function handleStatus(s: SyncStatus): string {
      switch (s.status) {
      case 'idle':
        return 'idle';
      case 'running':
        return 'running';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return s.status;
      }
    }
    for (const st of validStatuses) {
      expect(handleStatus({ ...{ last_sync: null, contacts_synced: 0, campaigns_enrolled: 0, errors: [] }, status: st })).toBe(st);
    }
  });
});

// ---------------------------------------------------------------------------
// Structural integrity across all types
// ---------------------------------------------------------------------------

describe('structural integrity', () => {
  it('all exported types construct without runtime errors', () => {
    const _env: Partial<MauticBridgeEnv> & {
      AURA_DB: never;
      MAUTIC_BASE_URL: string;
      MAUTIC_CLIENT_ID: string;
      MAUTIC_CLIENT_SECRET: string;
    } = {
      AURA_DB: {} as never,
      MAUTIC_BASE_URL: 'url',
      MAUTIC_CLIENT_ID: 'cid',
      MAUTIC_CLIENT_SECRET: 'csec'
    };
    const _contact: CustomerContact = {
      id: '1',
      name: 'Test',
      phone: '',
      email: 't@x.com',
      tier: 'bronze',
      total_spent: 0,
      visit_count: 0,
      last_visit: null
    };
    const _syncResp: SyncContactsResponse = { created: [], updated: [], errors: [] };
    const _status: SyncStatus = {
      last_sync: null,
      contacts_synced: 0,
      campaigns_enrolled: 0,
      errors: [],
      status: 'idle'
    };
    expect(typeof _env).toBe('object');
    expect(typeof _contact.email).toBe('string');
    expect(Array.isArray(_syncResp.created)).toBe(true);
    expect(typeof _status.status).toBe('string');
  });
});
