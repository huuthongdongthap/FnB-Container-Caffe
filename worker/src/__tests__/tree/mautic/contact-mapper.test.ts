/**
 * Unit tests for src/tree/mautic/contact-mapper.ts
 * Tests: toMauticContact field mapping, fallback logic, type shapes.
 * All runtime assertions — no :any.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toMauticContact } from '../../../tree/mautic/contact-mapper.js';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

type CustomerRecord = Record<string, unknown>;
type MauticContact = Record<string, unknown>;

function customer(overrides: Partial<CustomerRecord> = {}): CustomerRecord {
  return {
    id: 'c1',
    name: 'Nguyen Van A',
    phone: '0912345678',
    email: 'nguyen@example.com',
    loyalty_tier: 'silver',
    birthday: '1990-03-15',
    last_order_date: '2026-06-01',
    total_orders: 42,
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('toMauticContact', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('maps all fields from a full customer record', () => {
    const c = customer();
    const out = toMauticContact(c) as MauticContact;

    expect(typeof out).toBe('object');
    expect(out.firstname).toBe('Nguyen Van A');
    expect(out.email).toBe('nguyen@example.com');
    expect(out.phone).toBe('0912345678');
    expect(out.loyalty_tier).toBe('silver');
    expect(out.birthday).toBe('1990-03-15');
    expect(out.last_order_date).toBe('2026-06-01');
    expect(out.total_orders).toBe(42);
  });

  it('falls back to phone@aura-cafe.internal when email is missing', () => {
    const c = customer({ email: '' });
    const out = toMauticContact(c) as MauticContact;
    expect(out.email).toBe('0912345678@aura-cafe.internal');
  });

  it('falls back to phone@aura-cafe.internal when email is undefined', () => {
    const c = customer({ email: undefined });
    const out = toMauticContact(c) as MauticContact;
    expect(out.email).toBe('0912345678@aura-cafe.internal');
  });

  it('uses Khách as default name when name is missing', () => {
    const c = customer({ name: undefined });
    const out = toMauticContact(c) as MauticContact;
    expect(out.firstname).toBe('Khách');
  });

  it('uses Khách as default name when name is empty string', () => {
    const c = customer({ name: '' });
    const out = toMauticContact(c) as MauticContact;
    expect(out.firstname).toBe('Khách');
  });

  it('uses bronze as default loyalty_tier', () => {
    const c = customer({ loyalty_tier: undefined });
    const out = toMauticContact(c) as MauticContact;
    expect(out.loyalty_tier).toBe('bronze');
  });

  it('uses bronze as default loyalty_tier when empty string', () => {
    const c = customer({ loyalty_tier: '' });
    const out = toMauticContact(c) as MauticContact;
    expect(out.loyalty_tier).toBe('bronze');
  });

  it('resolves phone fallback to null when phone is also empty', () => {
    const c = customer({ phone: '', email: '' });
    const out = toMauticContact(c) as MauticContact;
    expect(out.phone).toBe('');
    expect(out.email).toBe('@aura-cafe.internal');
  });

  it('resolves birthday to null when birthday missing', () => {
    const c = customer({ birthday: undefined });
    const out = toMauticContact(c) as MauticContact;
    expect(out.birthday).toBeNull();
  });

  it('resolves last_order_date to null when missing', () => {
    const c = customer({ last_order_date: undefined });
    const out = toMauticContact(c) as MauticContact;
    expect(out.last_order_date).toBeNull();
  });

  it('resolves total_orders to 0 when missing', () => {
    const c = customer({ total_orders: undefined });
    const out = toMauticContact(c) as MauticContact;
    expect(out.total_orders).toBe(0);
  });

  it('returns 0 total_orders when value is 0', () => {
    const c = customer({ total_orders: 0 });
    const out = toMauticContact(c) as MauticContact;
    expect(out.total_orders).toBe(0);
  });

  it('output object has exactly the expected keys', () => {
    const c = customer();
    const out = toMauticContact(c) as MauticContact;
    const keys = Object.keys(out).sort();
    expect(keys).toEqual([
      'birthday',
      'email',
      'firstname',
      'last_order_date',
      'loyalty_tier',
      'phone',
      'total_orders'
    ]);
  });

  it('handles all-default customer record gracefully', () => {
    const c: CustomerRecord = {};
    const out = toMauticContact(c) as MauticContact;
    expect(out.firstname).toBe('Khách');
    expect(out.phone).toBe('');
    expect(out.email).toBe('@aura-cafe.internal');
    expect(out.loyalty_tier).toBe('bronze');
    expect(out.birthday).toBeNull();
    expect(out.last_order_date).toBeNull();
    expect(out.total_orders).toBe(0);
  });
});
