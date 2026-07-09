import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErpnextCrmClient, createErpnextCrmClient, createErpnextCrmClientWithKv } from '../../clients/erpnext-crm-client.js';

const ENV = {
  ERPNEXT_URL: 'https://erp.example.com',
  ERPNEXT_API_KEY: 'k',
  ERPNEXT_API_SECRET: 's'
};

function makeErpnext(methods: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    create: vi.fn(),
    read: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    ...methods
  };
}

function buildCrm(erpnext: Record<string, unknown>): ErpnextCrmClient {
  return new ErpnextCrmClient(erpnext as unknown as never);
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createErpnextCrmClient', () => {
  it('returns null when env missing URL', () => {
    expect(createErpnextCrmClient({})).toBeNull();
  });

  it('returns ErpnextCrmClient when creds present', () => {
    const c = createErpnextCrmClient(ENV);
    expect(c).toBeInstanceOf(ErpnextCrmClient);
  });

  it('getErpnext returns underlying client', () => {
    const c = createErpnextCrmClient(ENV);
    expect(c?.getErpnext()).toBeDefined();
  });
});

describe('createLead', () => {
  it('returns null when consent_marketing=false', async() => {
    const c = buildCrm(makeErpnext({ create: vi.fn() }));
    const result = await (c as unknown as { createLead: (d: unknown) => Promise<unknown> }).createLead({ name: 'Test', consent_marketing: false });
    expect(result).toBeNull();
  });

  it('maps customer data and creates lead', async() => {
    const createSpy = vi.fn().mockResolvedValue({ data: { name: 'LEAD-1' } });
    const client = buildCrm(makeErpnext({ create: createSpy }));
    const result = await (client as unknown as { createLead: (d: unknown) => Promise<unknown> }).createLead({
      name: 'Nguyen Van A',
      email: 'a@test.com',
      phone: '0909'
    });
    expect(result).toEqual({ leadId: 'LEAD-1' });
    expect(createSpy).toHaveBeenCalledWith('Lead', expect.objectContaining({
      first_name: 'Nguyen Van A',
      email_id: 'a@test.com',
      mobile_no: '0909'
    }));
  });

  it('truncates name to 140 chars', async() => {
    const createSpy = vi.fn().mockResolvedValue({ data: { name: 'L' } });
    const client = buildCrm(makeErpnext({ create: createSpy }));
    const longName = 'A'.repeat(200);
    await (client as unknown as { createLead: (d: unknown) => Promise<unknown> }).createLead({ name: longName });
    const mockCalls = (createSpy as unknown as { mock: { calls: [unknown, unknown][] } }).mock.calls as [unknown, unknown][];
    const [, payload] = mockCalls[0];
    expect((payload as Record<string, unknown>).first_name).toBe('A'.repeat(140));
  });

  it('throws when create returns no name', async() => {
    const client = buildCrm(makeErpnext({ create: vi.fn().mockResolvedValue({ data: {} }) }));
    await expect(
      (client as unknown as { createLead: (d: unknown) => Promise<unknown> }).createLead({ name: 'X' })
    ).rejects.toThrow('no name');
  });
});
