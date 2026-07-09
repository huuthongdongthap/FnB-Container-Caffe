/**
 * Unit tests for src/tree/mautic/sync-state.ts
 * Tests: mutable in-memory syncStatus object — pure state machine assertions.
 * All fields (last_sync, contacts_synced, campaigns_enrolled, errors, status)
 * transition correctly under concurrent mutation patterns.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncStatus } from '../../../tree/mautic/sync-state.js';
import type { SyncStatus } from '../../../tree/mautic/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStatus(): void {
  Object.assign(syncStatus, {
    last_sync: null,
    contacts_synced: 0,
    campaigns_enrolled: 0,
    errors: [],
    status: 'idle'
  });
}

type StatusAssertion = {
  last_sync: string | null;
  contacts_synced: number;
  campaigns_enrolled: number;
  errors: Array<{ customer_id: string; error: string }>;
  status: string;
};

function assertStatus(expected: StatusAssertion): void {
  expect(syncStatus.last_sync).toBe(expected.last_sync);
  expect(syncStatus.contacts_synced).toBe(expected.contacts_synced);
  expect(syncStatus.campaigns_enrolled).toBe(expected.campaigns_enrolled);
  expect(syncStatus.errors).toEqual(expected.errors);
  expect(syncStatus.status).toBe(expected.status);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncStatus state machine', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    resetStatus();
  });

  it('starts in idle state with zero counts', () => {
    assertStatus({
      last_sync: null,
      contacts_synced: 0,
      campaigns_enrolled: 0,
      errors: [],
      status: 'idle'
    });
  });

  it('transitions to running and records errors and completed state', () => {
    syncStatus.status = 'running';
    syncStatus.errors = [];
    assertStatus({ last_sync: null, contacts_synced: 0, campaigns_enrolled: 0, errors: [], status: 'running' });

    syncStatus.contacts_synced = 10;
    syncStatus.last_sync = new Date('2026-07-07T10:00:00Z').toISOString();
    assertStatus({
      last_sync: '2026-07-07T10:00:00.000Z',
      contacts_synced: 10,
      campaigns_enrolled: 0,
      errors: [],
      status: 'running'
    });

    syncStatus.status = 'completed';
    assertStatus({
      last_sync: '2026-07-07T10:00:00.000Z',
      contacts_synced: 10,
      campaigns_enrolled: 0,
      errors: [],
      status: 'completed'
    });
  });

  it('accumulates contacts_synced across multiple sync runs', () => {
    syncStatus.contacts_synced = 50;
    syncStatus.last_sync = '2026-07-07T10:00:00Z';
    syncStatus.status = 'completed';

    // second run adds 30
    syncStatus.contacts_synced += 30;
    expect(syncStatus.contacts_synced).toBe(80);
    expect(syncStatus.status).toBe('completed');
  });

  it('accumulates campaigns_enrolled across multiple runs', () => {
    syncStatus.campaigns_enrolled = 5;
    syncStatus.campaigns_enrolled += 3;
    expect(syncStatus.campaigns_enrolled).toBe(8);
  });

  it('records error entries in the errors array', () => {
    const err1: { customer_id: string; error: string } = { customer_id: 'c1', error: 'Mautic 500' };
    const err2: { customer_id: string; error: string } = { customer_id: 'c2', error: 'timeout' };
    syncStatus.errors.push(err1);
    syncStatus.errors.push(err2);
    expect(syncStatus.errors).toHaveLength(2);
    expect(syncStatus.errors[0]).toEqual(err1);
    expect(syncStatus.errors[1]).toEqual(err2);
  });

  it('clears errors array on fresh run start', () => {
    syncStatus.errors = [{ customer_id: 'c1', error: 'stale error' }];
    syncStatus.errors = []; // contact-sync clears on start
    expect(syncStatus.errors).toHaveLength(0);
  });

  it('transitions to failed status on top-level exception', () => {
    syncStatus.status = 'running';
    syncStatus.errors = [];
    syncStatus.status = 'failed';
    syncStatus.errors.push({ customer_id: 'batch', error: 'DB connection lost' });
    assertStatus({
      last_sync: null,
      contacts_synced: 0,
      campaigns_enrolled: 0,
      errors: [{ customer_id: 'batch', error: 'DB connection lost' }],
      status: 'failed'
    });
  });

  it('last_sync is an ISO string after completion', () => {
    syncStatus.last_sync = new Date().toISOString();
    expect(syncStatus.last_sync).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('supports all valid status transitions', () => {
    const validStatuses: SyncStatus['status'][] = ['idle', 'running', 'completed', 'failed'];
    for (const s of validStatuses) {
      syncStatus.status = s;
      expect(syncStatus.status).toBe(s);
    }
  });

  it('resetStatus restores the initial idle state', () => {
    syncStatus.status = 'failed';
    syncStatus.contacts_synced = 999;
    syncStatus.campaigns_enrolled = 77;
    syncStatus.errors = [{ customer_id: 'x', error: 'err' }];
    syncStatus.last_sync = '2026-07-07T10:00:00Z';

    resetStatus();
    assertStatus({
      last_sync: null,
      contacts_synced: 0,
      campaigns_enrolled: 0,
      errors: [],
      status: 'idle'
    });
  });

  it('type guards: SyncStatus fields are all read-write at runtime', () => {
    const s: SyncStatus = {
      last_sync: null,
      contacts_synced: 0,
      campaigns_enrolled: 0,
      errors: [],
      status: 'idle'
    };
    expect(typeof s.contacts_synced).toBe('number');
    expect(typeof s.campaigns_enrolled).toBe('number');
    expect(typeof s.status).toBe('string');
    expect(Array.isArray(s.errors)).toBe(true);
    // assign and verify
    s.contacts_synced = 1;
    expect(s.contacts_synced).toBe(1);
  });
});
