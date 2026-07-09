/**
 * Unit tests for src/tree/mautic/bridge-handler.ts
 * Tests: route dispatching by method+path, 404 fallback, sync-all aggregation.
 * Strategy: vi.mock at module scope with shared vi.fn references so tests can
 * assert call counts and swap return values safely.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMauticBridgeRequest } from '../../../tree/mautic/bridge-handler.js';

// ---------------------------------------------------------------------------
// Shared mock references — assigned once, safe for vi.mock hoisting because
// the variable bindings are resolved at evaluation time (not factory parse).
// ---------------------------------------------------------------------------

let syncContactsResult: Record<string, unknown>;
let enrollCampaignsResult: Record<string, unknown>;

const mockSync = vi.fn().mockImplementation(async(_env: unknown) => syncContactsResult);
const mockEnroll = vi.fn().mockImplementation(async(_env: unknown) => enrollCampaignsResult);

vi.mock('../../../tree/mautic/contact-sync', () => ({
  syncContacts: mockSync
}));

vi.mock('../../../tree/mautic/campaign-enrollment', () => ({
  enrollCampaigns: mockEnroll
}));

// ---------------------------------------------------------------------------
// Types + helpers
// ---------------------------------------------------------------------------

type SyncResult = { success: boolean; synced: number; errors: string[] };
type EnrollResult = { success: boolean; enrolled: number; errors: string[] };

function createRequest(method: string, pathname: string): Request {
  return new Request(`https://example.com${pathname}`, { method });
}

function makeSyncResult(overrides: Partial<SyncResult> = {}): SyncResult {
  return { success: true, synced: 0, errors: [], ...overrides };
}

function makeEnrollResult(overrides: Partial<EnrollResult> = {}): EnrollResult {
  return { success: true, enrolled: 0, errors: [], ...overrides };
}

function getHandlers() {
  return { syncContacts: mockSync, enrollCampaigns: mockEnroll };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleMauticBridgeRequest', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    syncContactsResult = makeSyncResult();
    enrollCampaignsResult = makeEnrollResult();
  });

  it('GET /status returns syncStatus payload with success:true', async() => {
    const req = createRequest('GET', '/api/mautic-bridge/status');
    const mod = await import('../../../tree/mautic/bridge-handler.js');
    const res = await mod.handleMauticBridgeRequest(req, {} as never);
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
  });

  it('POST /sync-contacts delegates to syncContacts and returns JSON', async() => {
    const handlers = getHandlers();
    handlers.syncContacts.mockResolvedValue(
      makeSyncResult({ success: true, synced: 15 }) as SyncResult
    );
    const req = createRequest('POST', '/api/mautic-bridge/sync-contacts');
    const mod = await import('../../../tree/mautic/bridge-handler.js');
    const res = await mod.handleMauticBridgeRequest(req, {} as never);
    expect(res.status).toBe(200);
    expect(handlers.syncContacts).toHaveBeenCalledTimes(1);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.synced).toBe(15);
  });

  it('POST /campaign-enroll delegates to enrollCampaigns', async() => {
    const handlers = getHandlers();
    handlers.enrollCampaigns.mockResolvedValue(
      makeEnrollResult({ success: true, enrolled: 3 }) as EnrollResult
    );
    const req = createRequest('POST', '/api/mautic-bridge/campaign-enroll');
    const mod = await import('../../../tree/mautic/bridge-handler.js');
    const res = await mod.handleMauticBridgeRequest(req, {} as never);
    expect(res.status).toBe(200);
    expect(handlers.enrollCampaigns).toHaveBeenCalledTimes(1);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.enrolled).toBe(3);
  });

  it('POST /sync-all runs both syncContacts and enrollCampaigns in sequence', async() => {
    const handlers = getHandlers();
    const req = createRequest('POST', '/api/mautic-bridge/sync-all');
    const mod = await import('../../../tree/mautic/bridge-handler.js');
    const res = await mod.handleMauticBridgeRequest(req, {} as never);
    expect(res.status).toBe(200);
    expect(handlers.syncContacts).toHaveBeenCalledTimes(1);
    expect(handlers.enrollCampaigns).toHaveBeenCalledTimes(1);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.success).toBe(true);
    expect((data.data as Record<string, unknown>).contacts).toBeDefined();
    expect((data.data as Record<string, unknown>).campaigns).toBeDefined();
  });

  it('unknown path returns 404 with success:false and error message', async() => {
    const req = createRequest('GET', '/api/mautic-bridge/unknown-route');
    const mod = await import('../../../tree/mautic/bridge-handler.js');
    const res = await mod.handleMauticBridgeRequest(req, {} as never);
    expect(res.status).toBe(404);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.success).toBe(false);
    expect(data.error).toBe('Not found');
  });

  it('GET request to /campaign-enroll returns 404 (only POST accepted)', async() => {
    const req = createRequest('GET', '/api/mautic-bridge/campaign-enroll');
    const mod = await import('../../../tree/mautic/bridge-handler.js');
    const res = await mod.handleMauticBridgeRequest(req, {} as never);
    expect(res.status).toBe(404);
  });

  it('response Content-Type header is application/json for all endpoints', async() => {
    const mod = await import('../../../tree/mautic/bridge-handler.js');
    const endpoints = [
      createRequest('GET', '/api/mautic-bridge/status'),
      createRequest('POST', '/api/mautic-bridge/sync-contacts'),
      createRequest('POST', '/api/mautic-bridge/campaign-enroll'),
      createRequest('POST', '/api/mautic-bridge/sync-all'),
      createRequest('GET', '/api/mautic-bridge/other')
    ];
    for (const req of endpoints) {
      const res = await mod.handleMauticBridgeRequest(req, {} as never);
      expect(res.headers.get('Content-Type')).toBe('application/json');
    }
  });

  it('propagates errors from syncContacts without crashing', async() => {
    const handlers = getHandlers();
    handlers.syncContacts.mockResolvedValue(
      makeSyncResult({ success: false, errors: ['DB error'] }) as SyncResult
    );
    const req = createRequest('POST', '/api/mautic-bridge/sync-contacts');
    const mod = await import('../../../tree/mautic/bridge-handler.js');
    const res = await mod.handleMauticBridgeRequest(req, {} as never);
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.success).toBe(false);
  });

  it('handles error from enrollCampaigns gracefully', async() => {
    const handlers = getHandlers();
    handlers.enrollCampaigns.mockResolvedValue(
      makeEnrollResult({ success: false, errors: ['Mautic down'] }) as EnrollResult
    );
    const req = createRequest('POST', '/api/mautic-bridge/campaign-enroll');
    const mod = await import('../../../tree/mautic/bridge-handler.js');
    const res = await mod.handleMauticBridgeRequest(req, {} as never);
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.success).toBe(false);
  });
});
