/**
 * Unit tests for src/tree/pretix/types.ts
 * Tests: interface shapes, optional fields, index signatures, type guards
 */

import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — suppress the @cloudflare/workers-types re-export so the import
// at the top of the module resolves (it's a types-only package).
// ---------------------------------------------------------------------------

vi.mock('@cloudflare/workers-types', () => ({
  D1Database: Object
}));

// ---------------------------------------------------------------------------
// Real imports — after vi.mock() so resolution uses the mock
// ---------------------------------------------------------------------------

import {
  PretixEnv,
  PretixWebhookBody,
  PretixItemsResponse,
  PretixItem,
  PretixEventResponse,
  PretixCheckinBody,
  PretixGenerateBody
} from '../../tree/pretix/types.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const VALID_PRETIX_WEBHOOK_BODY: PretixWebhookBody = {
  notification_id: 42,
  organizer: 'acme-events',
  event: 'summer-2026',
  code: 'ABC-123-XYZ',
  action: 'order_placed'
};

const MINIMAL_PRETIX_ITEM: PretixItem = {
  id: 'item-1',
  name: { en: 'Standard Ticket', vi: 'Vé thường' },
  price: 500000
};

const FULL_PRETIX_ITEM: PretixItem = {
  id: 'item-42',
  name: { en: 'VIP Ticket', de: 'VIP-Ticket' },
  price: 1500000
};

const PRETIX_ITEMS_RESPONSE_WITH_RESULTS: PretixItemsResponse = {
  results: [MINIMAL_PRETIX_ITEM, FULL_PRETIX_ITEM]
};

const PRETIX_ITEMS_RESPONSE_EMPTY: PretixItemsResponse = {};

const MINIMAL_PRETIX_EVENT_RESPONSE: PretixEventResponse = {
  name: { en: 'Summer Conference' }
};

const FULL_PRETIX_EVENT_RESPONSE: PretixEventResponse = {
  name: { en: 'Summer Conference', vi: 'Hội nghị Hè' },
  items: [MINIMAL_PRETIX_ITEM]
};

const VALID_PRETIX_CHECKIN_BODY: PretixCheckinBody = {
  secret: 'checkin-secret-abc',
  event: 'summer-2026',
  listId: 1
};

const VALID_PRETIX_GENERATE_BODY: PretixGenerateBody = {
  source: 'bulk-codes',
  slug: 'my-event'
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) {
    return false;
  }
  return keysA.every((k) => {
    const ak = k as keyof T;
    const bk = k as keyof T;
    return Object.is((a as Record<string, unknown>)[ak], (b as Record<string, unknown>)[bk]);
  });
}

function hasKey<T>(obj: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function describeProps(actual: object, expectedKeys: PropertyKey[]): void {
  const missing = expectedKeys.filter((k) => !hasKey(actual, k));
  const extra = Object.keys(actual).filter(
    (k) => !expectedKeys.includes(k as PropertyKey)
  );
  return {
    missing,
    extra,
    allPresent: missing.length === 0
  } as { missing: PropertyKey[]; extra: string[]; allPresent: boolean };
}

// ---------------------------------------------------------------------------
// PretixEnv
// ---------------------------------------------------------------------------

describe('PretixEnv', () => {
  it('has the correct required shape with all fields present', () => {
    const env: PretixEnv = {
      PRETIX_API_URL: 'https://pretix.eu/api/v1',
      PRETIX_API_TOKEN: 'token-abc',
      PRETIX_ORGANIZER: 'my-org',
      PRETIX_WEBHOOK_SECRET: 'wh-secret',
      AURA_DB: {} as unknown as PretixEnv['AURA_DB'],
      customKey: 'extra-value'
    };
    expect(env.PRETIX_API_URL).toBe('https://pretix.eu/api/v1');
    expect(env.PRETIX_API_TOKEN).toBe('token-abc');
    expect(env.PRETIX_ORGANIZER).toBe('my-org');
    expect(env.PRETIX_WEBHOOK_SECRET).toBe('wh-secret');
    expect(hasKey(env, 'AURA_DB')).toBe(true);
    expect(hasKey(env, 'customKey')).toBe(true);
  });

  it('accepts an empty index signature entry', () => {
    const env: PretixEnv = {
      PRETIX_API_URL: 'https://pretix.eu/api/v1'
    };
    // the [key: string]: unknown index signature should allow arbitrary keys
    expect(hasKey(env, 'PRETIX_API_URL')).toBe(true);

    expect((env as any).PRETIX_API_URL).toBe('https://pretix.eu/api/v1');
  });

  it('allows only string keys on the index signature', () => {
    const env: Record<string, unknown> = {
      PRETIX_API_URL: 'url',
      someNumber: 42
    } as unknown as PretixEnv;
    expect(env.PRETIX_API_URL).toBe('url');
  });
});

// ---------------------------------------------------------------------------
// PretixWebhookBody
// ---------------------------------------------------------------------------

describe('PretixWebhookBody', () => {
  it('accepts a fully populated webhook body', () => {
    const body: PretixWebhookBody = VALID_PRETIX_WEBHOOK_BODY;
    expect(body.notification_id).toBe(42);
    expect(body.organizer).toBe('acme-events');
    expect(body.event).toBe('summer-2026');
    expect(body.code).toBe('ABC-123-XYZ');
    expect(body.action).toBe('order_placed');
  });

  it('field types match the interface contract', () => {
    const body: PretixWebhookBody = VALID_PRETIX_WEBHOOK_BODY;
    expect(typeof body.notification_id).toBe('number');
    expect(typeof body.organizer).toBe('string');
    expect(typeof body.event).toBe('string');
    expect(typeof body.code).toBe('string');
    expect(typeof body.action).toBe('string');
  });

  it('rejects objects missing required fields', () => {
    // @ts-expect-error — missing required fields; this object must not be assignable
    const _bad: PretixWebhookBody = { notification_id: 1, organizer: 'o', event: 'e' };
    void _bad; // silence unused warning — this block is a compile-time check
  });
});

// ---------------------------------------------------------------------------
// PretixItemsResponse
// ---------------------------------------------------------------------------

describe('PretixItemsResponse', () => {
  it('accepts a response with results array', () => {
    const resp: PretixItemsResponse = PRETIX_ITEMS_RESPONSE_WITH_RESULTS;
    const results = resp.results;
    expect(Array.isArray(results)).toBe(true);
    expect(results!.length).toBe(2);
    expect(results![0]).toEqual(MINIMAL_PRETIX_ITEM);
  });

  it('each item in results conforms to PretixItem', () => {
    const resp = PRETIX_ITEMS_RESPONSE_WITH_RESULTS;
    const [first, second] = resp.results!;
    expect(first.id).toBe('item-1');
    expect(typeof first.price).toBe('number');
    expect(typeof first.name).toBe('object');
    expect(hasKey(first.name, 'en')).toBe(true);
    expect(hasKey(first.name, 'vi')).toBe(true);
    expect(second.id).toBe('item-42');
    expect(typeof second.price).toBe('number');
  });

  it('accepts an empty response (no results field)', () => {
    const resp: PretixItemsResponse = {};
    expect(resp.results).toBeUndefined();
  });

  it('accepts an empty results array', () => {
    const resp: PretixItemsResponse = { results: [] };
    expect(resp.results!.length).toBe(0);
  });

  it('results array can contain items with varied locale keys', () => {
    const resp: PretixItemsResponse = {
      results: [
        { id: '1', name: { en: 'A' }, price: 100 },
        { id: '2', name: { en: 'B', de: 'B-DE', fr: 'B-FR' }, price: 200 }
      ]
    };

    expect((resp.results![1].name as any).de).toBe('B-DE');
  });
});

// ---------------------------------------------------------------------------
// PretixItem
// ---------------------------------------------------------------------------

describe('PretixItem', () => {
  it('requires id, name, and price fields', () => {
    const item: PretixItem = MINIMAL_PRETIX_ITEM;
    expect(typeof item.id).toBe('string');
    expect(typeof item.price).toBe('number');
    expect(item.price).toBeGreaterThan(0);
  });

  it('name field is a Record<string, string> keyed by locale', () => {
    const item: PretixItem = MINIMAL_PRETIX_ITEM;
    expect(typeof item.name).toBe('object');
    expect(item.name.en).toBe('Standard Ticket');
    expect(item.name.vi).toBe('Vé thường');
  });

  it('price is a number (not a string)', () => {
    const item: PretixItem = MINIMAL_PRETIX_ITEM;
    expect(typeof item.price).toBe('number');
    expect(typeof item.price).not.toBe('string');
  });

  it('rejects an item missing the price field', () => {
    // @ts-expect-error — missing required 'price'; compile-time contract check
    const _bad: PretixItem = { id: '1', name: { en: 'X' } };
    void _bad;
  });

  it('accepts a price of zero (free event item)', () => {
    const item: PretixItem = { id: 'free', name: { en: 'Free Entry' }, price: 0 };
    expect(item.price).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// PretixEventResponse
// ---------------------------------------------------------------------------

describe('PretixEventResponse', () => {
  it('accepts a response with name only', () => {
    const resp: PretixEventResponse = MINIMAL_PRETIX_EVENT_RESPONSE;
    expect(resp.name).toBeDefined();
    expect(resp.name!.en).toBe('Summer Conference');
    expect(resp.items).toBeUndefined();
  });

  it('accepts a response with name and items', () => {
    const resp: PretixEventResponse = FULL_PRETIX_EVENT_RESPONSE;
    expect(resp.name!.en).toBe('Summer Conference');
    expect(resp.name!.vi).toBe('Hội nghị Hè');
    expect(resp.items!.length).toBe(1);
    expect(resp.items![0]).toEqual(MINIMAL_PRETIX_ITEM);
  });

  it('accepts an empty response (all fields optional)', () => {
    const resp: PretixEventResponse = {};
    expect(resp.name).toBeUndefined();
    expect(resp.items).toBeUndefined();
  });

  it('name field is a Record<string, string>', () => {
    const resp: PretixEventResponse = { name: { en: 'A', vi: 'B', de: 'C' } };
    expect(typeof resp.name).toBe('object');
    expect(resp.name!.en).toBe('A');
    expect(resp.name!.de).toBe('C');
  });

  it('name field is undefined when not provided', () => {
    const resp: PretixEventResponse = { items: [MINIMAL_PRETIX_ITEM] };
    expect(resp.name).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PretixCheckinBody
// ---------------------------------------------------------------------------

describe('PretixCheckinBody', () => {
  it('accepts a fully populated checkin body', () => {
    const body: PretixCheckinBody = VALID_PRETIX_CHECKIN_BODY;
    expect(body.secret).toBe('checkin-secret-abc');
    expect(body.event).toBe('summer-2026');
    expect(body.listId).toBe(1);
  });

  it('accepts a minimal checkin body with only the secret', () => {
    const body: PretixCheckinBody = { secret: 's' };
    expect(body.secret).toBe('s');
    expect(body.event).toBeUndefined();
    expect(body.listId).toBeUndefined();
  });

  it('secret field must be a string', () => {
    const body: PretixCheckinBody = VALID_PRETIX_CHECKIN_BODY;
    expect(typeof body.secret).toBe('string');
    expect(body.secret.length).toBeGreaterThan(0);
  });

  it('event is an optional string field', () => {
    const body: PretixCheckinBody = { secret: 's', event: 'e', listId: 2 };
    expect(typeof body.event).toBe('string');
    expect(body.event).toBe('e');
  });

  it('listId is an optional number field', () => {
    const body: PretixCheckinBody = VALID_PRETIX_CHECKIN_BODY;
    expect(typeof body.listId).toBe('number');
    // must be a valid integer
    expect(Number.isInteger(body.listId)).toBe(true);
  });

  it('rejects a body missing the required secret', () => {
    // @ts-expect-error — missing required 'secret'; compile-time check
    const _bad: PretixCheckinBody = { event: 'e', listId: 1 };
    void _bad;
  });
});

// ---------------------------------------------------------------------------
// PretixGenerateBody
// ---------------------------------------------------------------------------

describe('PretixGenerateBody', () => {
  it('accepts a fully populated generate body', () => {
    const body: PretixGenerateBody = VALID_PRETIX_GENERATE_BODY;
    expect(body.source).toBe('bulk-codes');
    expect(body.slug).toBe('my-event');
  });

  it('source and slug are both required strings', () => {
    const body: PretixGenerateBody = VALID_PRETIX_GENERATE_BODY;
    expect(typeof body.source).toBe('string');
    expect(typeof body.slug).toBe('string');
    expect(body.source.length).toBeGreaterThan(0);
    expect(body.slug.length).toBeGreaterThan(0);
  });

  it('rejects an object missing source', () => {
    // @ts-expect-error — missing required 'source'; compile-time check
    const _bad: PretixGenerateBody = { slug: 'x' };
    void _bad;
  });

  it('rejects an object missing slug', () => {
    // @ts-expect-error — missing required 'slug'; compile-time check
    const _bad: PretixGenerateBody = { source: 'x' };
    void _bad;
  });

  it('accepts source values other than bulk-codes', () => {
    const body: PretixGenerateBody = { source: 'random', slug: 'evt' };
    expect(body.source).toBe('random');
  });

  it('source value "bulk-codes" and slug "my-event" round-trip through JSON', () => {
    const body: PretixGenerateBody = VALID_PRETIX_GENERATE_BODY;
    const serialized = JSON.stringify(body);
    const parsed = JSON.parse(serialized) as PretixGenerateBody;
    expect(parsed.source).toBe('bulk-codes');
    expect(parsed.slug).toBe('my-event');
  });
});

// ---------------------------------------------------------------------------
// Structural integrity — all required fields present across every export
// ---------------------------------------------------------------------------

describe('structural integrity', () => {
  it('all exported interfaces are constructible without runtime errors', () => {
    // If any assignment in this block throws, the test will catch it
    const _env: PretixEnv = { PRETIX_API_URL: 'url' };
    const _webhook: PretixWebhookBody = VALID_PRETIX_WEBHOOK_BODY;
    const _itemsResp: PretixItemsResponse = PRETIX_ITEMS_RESPONSE_WITH_RESULTS;
    const _item: PretixItem = MINIMAL_PRETIX_ITEM;
    const _eventResp: PretixEventResponse = MINIMAL_PRETIX_EVENT_RESPONSE;
    const _checkin: PretixCheckinBody = VALID_PRETIX_CHECKIN_BODY;
    const _generate: PretixGenerateBody = VALID_PRETIX_GENERATE_BODY;

    // Reachability check — sprinkler of conciseness assertions
    expect(typeof _env).toBe('object');
    expect(typeof _webhook.notification_id).toBe('number');
    expect(Array.isArray(_itemsResp.results)).toBe(true);
    expect(typeof _item.price).toBe('number');
    expect(_eventResp.name?.en).toBe('Summer Conference');
    expect(_checkin.secret).toBe('checkin-secret-abc');
    expect(_generate.slug).toBe('my-event');
  });
});
