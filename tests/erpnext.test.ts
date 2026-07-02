/**
 * ERPNext CRM Routes Tests — handleErpnextRequest
 *
 * Tests for CRM lead creation, customer notes, tags via erpnext-crm-client.
 *
 * @vitest-test-type unit
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Mock erpnext-crm-client ──────────────────────────────────────────────
const mockCrmClient = {
  createLead: vi.fn(),
  getCustomerInfo: vi.fn(),
  addTag: vi.fn(),
  removeTag: vi.fn(),
  updateCustomer: vi.fn(),
};

vi.mock('../worker/src/clients/erpnext-crm-client', () => ({
  createErpnextCrmClient: vi.fn(
    (env: Record<string, unknown>) => env.ERPNEXT_URL ? mockCrmClient : null
  ),
  createErpnextCrmClientWithKv: vi.fn(
    async (env: Record<string, unknown>) => env.ERPNEXT_URL ? mockCrmClient : null
  ),
}));

let handleErpnextRequest: any;

beforeEach(() => {
  vi.clearAllMocks();
});

async function mountHandler() {
  const mod = await import('../worker/src/routes/erpnext');
  handleErpnextRequest = mod.handleErpnextRequest;
}

const configuredEnv = { ERPNEXT_URL: 'https://erp.test', ERPNEXT_API_KEY: 'key', ERPNEXT_API_SECRET: 'secret' };

describe('POST /lead', () => {
  test('creates lead successfully', async () => {
    mockCrmClient.createLead.mockResolvedValue({ leadId: 'LEAD-001' });
    await mountHandler();

    const req = new Request('https://test/api/erpnext/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Customer', email: 'test@test.com', phone: '0901234567' }),
    });
    const res = await handleErpnextRequest(req, configuredEnv);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.leadId).toBe('LEAD-001');
    expect(mockCrmClient.createLead).toHaveBeenCalledTimes(1);
  });

  test('returns 503 when ERPNext not configured', async () => {
    const crmMod = await import('../worker/src/clients/erpnext-crm-client');
    (crmMod.createErpnextCrmClient as any).mockReturnValueOnce(null);
    await mountHandler();

    const req = new Request('https://test/api/erpnext/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    const res = await handleErpnextRequest(req, {});

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/not configured/i);
  });

  test('handles client error gracefully', async () => {
    mockCrmClient.createLead.mockRejectedValue(new Error('API timeout'));
    await mountHandler();

    const req = new Request('https://test/api/erpnext/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    const res = await handleErpnextRequest(req, configuredEnv);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('API timeout');
  });
});

describe('GET /customer/:id', () => {
  test('returns customer info', async () => {
    mockCrmClient.getCustomerInfo.mockResolvedValue({
      notes: 'VIP customer',
      tags: ['vip', 'wholesale'],
      lastActivity: '2025-01-01',
    });
    await mountHandler();

    const req = new Request('https://test/api/erpnext/customer/CUST-001', { method: 'GET' });
    const res = await handleErpnextRequest(req, configuredEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.tags).toContain('vip');
    expect(mockCrmClient.getCustomerInfo).toHaveBeenCalledWith('CUST-001');
  });

  test('returns 404 for unknown route', async () => {
    await mountHandler();
    const req = new Request('https://test/api/erpnext/unknown', { method: 'GET' });
    const res = await handleErpnextRequest(req, configuredEnv);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});

describe('POST /customer/:id/tag', () => {
  test('adds tag successfully', async () => {
    mockCrmClient.addTag.mockResolvedValue(true);
    await mountHandler();

    const req = new Request('https://test/api/erpnext/customer/CUST-001/tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: 'vip' }),
    });
    const res = await handleErpnextRequest(req, configuredEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockCrmClient.addTag).toHaveBeenCalledWith('CUST-001', 'vip');
  });
});

describe('DELETE /customer/:id/tag', () => {
  test('removes tag successfully', async () => {
    mockCrmClient.removeTag.mockResolvedValue(true);
    await mountHandler();

    const req = new Request('https://test/api/erpnext/customer/CUST-001/tag', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: 'vip' }),
    });
    const res = await handleErpnextRequest(req, configuredEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockCrmClient.removeTag).toHaveBeenCalledWith('CUST-001', 'vip');
  });
});

describe('PUT /customer/:id', () => {
  test('updates customer successfully', async () => {
    mockCrmClient.updateCustomer.mockResolvedValue(true);
    await mountHandler();

    const req = new Request('https://test/api/erpnext/customer/CUST-001', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: 'Updated Name' }),
    });
    const res = await handleErpnextRequest(req, configuredEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockCrmClient.updateCustomer).toHaveBeenCalledWith('CUST-001', { customer_name: 'Updated Name' });
  });
});
