import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ErpnextClient,
  ErpnextError,
  MalformedResponseError,
  createErpnextClient,
  createErpnextClientWithKv
} from '../../clients/erpnext-client.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXTURE_URL = 'https://erp.example.com';
const FIXTURE_KEY = 'k';
const FIXTURE_SECRET = 's';

function makeConfig(overrides: Record<string, unknown> = {}): never {
  return {
    url: FIXTURE_URL,
    apiKey: FIXTURE_KEY,
    apiSecret: FIXTURE_SECRET,
    ...overrides
  } as never;
}

function makeClient(overrides: Record<string, unknown> = {}): ErpnextClient {
  return new ErpnextClient(makeConfig(overrides) as unknown as never);
}

let fetchStub: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchStub = vi.fn();
  vi.stubGlobal('fetch', fetchStub);
});

function mockFetchOk(body: Record<string, unknown> = { data: { name: 'TEST-1' } }) {
  fetchStub.mockResolvedValue({
    ok: true,
    status: 200,
    json: async() => body
  } as unknown as Response);
}

// ---------------------------------------------------------------------------
// Constructor / factory
// ---------------------------------------------------------------------------

describe('ErpnextClient', () => {
  it('createErpnextClient returns a configured client', () => {
    const client = createErpnextClient({
      ERPNEXT_URL: FIXTURE_URL,
      ERPNEXT_API_KEY: FIXTURE_KEY,
      ERPNEXT_API_SECRET: FIXTURE_SECRET
    } as never);
    expect(client).toBeInstanceOf(ErpnextClient);
  });

  it('createErpnextClientWithKv returns a configured client with KV', async() => {
    const client = await createErpnextClientWithKv({
      ERPNEXT_URL: FIXTURE_URL,
      ERPNEXT_API_KEY: FIXTURE_KEY,
      ERPNEXT_API_SECRET: FIXTURE_SECRET,
      AUTH_KV: null as never
    } as never);
    expect(client).toBeInstanceOf(ErpnextClient);
  });

  // -------------------------------------------------------------------------
  // read
  // -------------------------------------------------------------------------

  it('read returns parsed data on success', async() => {
    mockFetchOk({ data: { name: 'CUST-1' } });
    const resp = await makeClient().read('Customer', 'CUST-1');
    expect((resp as { data: { name: string } }).data.name).toBe('CUST-1');
  });

  it('read throws ErpnextError on non-ok response', async() => {
    const errBody = { exc_type: 'frappe.exceptions.ValidationError', message: 'bad gateway' };
    fetchStub.mockResolvedValue({
      ok: false,
      status: 502,
      json: async() => errBody as never,
      text: async() => ''
    } as unknown as Response);
    await expect(
      makeClient().read('Customer', 'X')
    ).rejects.toBeInstanceOf(ErpnextError);
  });

  it('throws MalformedResponseError on invalid JSON body', async() => {
    fetchStub.mockResolvedValue({
      ok: true,
      status: 200,
      json: async() => {
        throw new SyntaxError('not json');
      },
      text: async() => ''
    } as unknown as Response);
    await expect(
      makeClient().read('Customer', 'X')
    ).rejects.toBeInstanceOf(MalformedResponseError);
  });

  it('throws ErpnextError when response has exc_type', async() => {
    fetchStub.mockResolvedValue({
      ok: false,
      status: 400,
      json: async() => ({ exc_type: 'ValidationError', exc: 'Required field missing' } as never),
      text: async() => ''
    } as unknown as Response);
    await expect(
      makeClient().read('Customer', 'X')
    ).rejects.toBeInstanceOf(ErpnextError);
  });
});

// ---------------------------------------------------------------------------
// Retry logic
// ---------------------------------------------------------------------------
