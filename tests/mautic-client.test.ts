/**
 * Mautic REST API Client Unit Tests
 *
 * Tests for MauticClient — OAuth2 client credentials flow, contact management,
 * segment/campaign membership, retry logic, and error handling.
 *
 * TDD pattern: these tests define the contract; run RED first (no implementation),
 * then implement mautic-client.ts to GREEN.
 *
 * @see ../worker/src/lib/mautic-client.ts
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MauticClient,
  MauticError,
  MauticAuthError,
  MauticNetworkError,
  createMauticClient,
} from '../worker/src/lib/mautic-client.ts';

const MOCK_BASE_URL = 'https://mautic.aura.cafe';
const MOCK_CLIENT_ID = 'test_client';
const MOCK_CLIENT_SECRET = 'test_secret';

function mockTokenResponse(overrides: Record<string, unknown> = {}) {
  return {
    access_token: 'mock_access_token_abc123',
    expires_in: 3600,
    token_type: 'Bearer',
    ...overrides,
  };
}

describe('MauticClient', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create client with valid config', () => {
      const client = new MauticClient(MOCK_BASE_URL, MOCK_CLIENT_ID, MOCK_CLIENT_SECRET);
      expect(client.baseUrl).toBe('https://mautic.aura.cafe');
      expect(client.clientId).toBe('test_client');
      expect(client.clientSecret).toBe('test_secret');
      expect((client as any)._token).toBeNull();
      expect((client as any)._tokenExpiresAt).toBe(0);
    });

    test('should strip trailing slash from baseUrl', () => {
      const client = new MauticClient('https://mautic.aura.cafe/', MOCK_CLIENT_ID, MOCK_CLIENT_SECRET);
      expect(client.baseUrl).toBe('https://mautic.aura.cafe');
    });
  });

  describe('authenticate', () => {
    test('should obtain access token via client credentials grant', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTokenResponse(),
      });

      const client = new MauticClient(MOCK_BASE_URL, MOCK_CLIENT_ID, MOCK_CLIENT_SECRET);
      const token = await client.authenticate();

      expect(token).toBe('mock_access_token_abc123');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        'https://mautic.aura.cafe/oauth/v2/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
          body: expect.stringContaining('grant_type=client_credentials'),
        })
      );
    });

    test('should cache token in-memory and reuse until expires', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTokenResponse(),
      });

      const client = new MauticClient(MOCK_BASE_URL, MOCK_CLIENT_ID, MOCK_CLIENT_SECRET);
      await client.authenticate();
      const token2 = await client.authenticate();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(token2).toBe('mock_access_token_abc123');
    });

    test('should re-authenticate when cached token is expired', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTokenResponse({ expires_in: 0 }),
      });

      const client = new MauticClient(MOCK_BASE_URL, MOCK_CLIENT_ID, MOCK_CLIENT_SECRET);
      await client.authenticate();

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTokenResponse({ expires_in: 3600, access_token: 'fresh_token_xyz' }),
      });

      const token3 = await client.authenticate();
      expect(token3).toBe('fresh_token_xyz');
    });

    test('should throw MauticAuthError on invalid credentials', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_client', error_description: 'Bad credentials' }),
      });

      const client = new MauticClient(MOCK_BASE_URL, MOCK_CLIENT_ID, MOCK_CLIENT_SECRET);
      await expect(client.authenticate()).rejects.toThrow(MauticAuthError);
    });

    test('should throw MauticNetworkError on network failure during auth', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const client = new MauticClient(MOCK_BASE_URL, MOCK_CLIENT_ID, MOCK_CLIENT_SECRET);
      await expect(client.authenticate()).rejects.toThrow(MauticNetworkError);
    });
  });

  describe('createOrUpdateContact', () => {
    test('should create contact via POST /api/contacts/new and return contact ID', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockTokenResponse() })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            contact: { id: 123, email: 'john@example.com', firstname: 'John', lastname: 'Doe' },
          }),
        });
      globalThis.fetch = fn;

      const client = new MauticClient(MOCK_BASE_URL, MOCK_CLIENT_ID, MOCK_CLIENT_SECRET);
      const contactId = await client.createOrUpdateContact({
        email: 'john@example.com',
        firstname: 'John',
        lastname: 'Doe',
        phone: '0901234567',
      });

      expect(contactId).toBe(123);
      expect(fn).toHaveBeenCalledTimes(2);
      const [, contactCall] = (fn as any).mock.calls;
      expect(contactCall[0]).toBe('https://mautic.aura.cafe/api/contacts/new');
      expect(contactCall[1].method).toBe('POST');
      expect(JSON.parse(contactCall[1].body)).toEqual({
        email: 'john@example.com',
        firstname: 'John',
        lastname: 'Doe',
        phone: '0901234567',
      });
    });

    test('should generate internal email for phone-only contacts', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockTokenResponse() })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            contact: { id: 456, email: '0901234567@aura-cafe.internal' },
          }),
        });
      globalThis.fetch = fn;

      const client = new MauticClient(MOCK_BASE_URL, MOCK_CLIENT_ID, MOCK_CLIENT_SECRET);
      const contactId = await client.createOrUpdateContact({
        phone: '0901234567',
        firstname: 'Jane',
      });

      expect(contactId).toBe(456);
      const [, contactCall] = (fn as any).mock.calls;
      const body = JSON.parse(contactCall[1].body);
      expect(body.email).toBe('0901234567@aura-cafe.internal');
      expect(body.firstname).toBe('Jane');
    });

    test('should throw MauticError on contact creation failure', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockTokenResponse() })
        .mockResolvedValueOnce({
          ok: false,
          status: 422,
          json: async () => ({ error: 'email: This value is already used', errors: {} }),
        });
      globalThis.fetch = fn;

      const client = new MauticClient(MOCK_BASE_URL, MOCK_CLIENT_ID, MOCK_CLIENT_SECRET);
      await expect(
        client.createOrUpdateContact({ email: 'dupe@example.com' })
      ).rejects.toThrow(MauticError);
    });
  });

  describe('batchUpsertContacts', () => {
    const contacts = [
      { email: 'alice@example.com', firstname: 'Alice' },
      { email: 'bob@example.com', firstname: 'Bob', phone: '0912345678' },
    ];

    test('should batch upsert contacts via POST /api/contacts/batch/new', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockTokenResponse() })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            contacts: [
              { id: 1, email: 'alice@example.com' },
              { id: 2, email: 'bob@example.com' },
            ],
          }),
        });
      globalThis.fetch = fn;

      const client = new MauticClient(MOCK_BASE_URL, MOCK_CLIENT_ID, MOCK_CLIENT_SECRET);
      const result = await client.batchUpsertContacts(contacts);

      expect(result).toEqual({
        created: [{ id: 1, email: 'alice@example.com' }, { id: 2, email: 'bob@example.com' }],
        updated: [],
        errors: [],
      });

      const [, batchCall] = (fn as any).mock.calls;
      expect(batchCall[0]).toBe('https://mautic.aura.cafe/api/contacts/batch/new');
      expect(batchCall[1].method).toBe('POST');
      expect(JSON.parse(batchCall[1].body)).toHaveLength(2);
    });

    test('should separate created, updated, and errors in batch response', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockTokenResponse() })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            contacts: [{ id: 1, email: 'alice@example.com' }],
            statusCodes: { 'alice@example.com': 201, 'bob@example.com': 200 },
            errors: { 'charlie@example.com': { error: 'Invalid email' } },
          }),
        });
      globalThis.fetch = fn;

      const client = new MauticClient(MOCK_BASE_URL, MOCK_CLIENT_ID, MOCK_CLIENT_SECRET);
      const result = await client.batchUpsertContacts([
        { email: 'alice@example.com' },
        { email: 'bob@example.com' },
        { email: 'charlie@example.com' },
      ]);

      expect(result.created).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({ email: 'charlie@example.com', error: 'Invalid email' });
    });
  });

  describe('addContactToSegment', () => {
    test('should add contact to segment via POST /api/segments/{segId}/contact/{contactId}/add', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockTokenResponse() })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ contact: { id: 123 } }) });
      globalThis.fetch = fn;

      const client = new MauticClient(MOCK_BASE_URL, MOCK_CLIENT_ID, MOCK_CLIENT_SECRET);
      const result = await client.addContactToSegment(123, 456);

      expect(result).toBe(true);
      const [, segCall] = (fn as any).mock.calls;
      expect(segCall[0]).toBe('https://mautic.aura.cafe/api/segments/456/contact/123/add');
      expect(segCall[1].method).toBe('POST');
    });

    test('should return false on failure to add to segment', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockTokenResponse() })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Segment not found' }),
        });
      globalThis.fetch = fn;

      const client = new MauticClient(MOCK_BASE_URL, MOCK_CLIENT_ID, MOCK_CLIENT_SECRET);
      const result = await client.addContactToSegment(999, 999);

      expect(result).toBe(false);
    });
  });

  describe('addContactToCampaign', () => {
    test('should add contact to campaign via POST /api/campaigns/{campId}/contact/{contactId}/add', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockTokenResponse() })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
      globalThis.fetch = fn;

      const client = new MauticClient(MOCK_BASE_URL, MOCK_CLIENT_ID, MOCK_CLIENT_SECRET);
      const result = await client.addContactToCampaign(123, 789);

      expect(result).toBe(true);
      const [, campCall] = (fn as any).mock.calls;
      expect(campCall[0]).toBe('https://mautic.aura.cafe/api/campaigns/789/contact/123/add');
      expect(campCall[1].method).toBe('POST');
    });

    test('should return false on failure to add to campaign', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockTokenResponse() })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: async () => ({ error: 'Campaign not accessible' }),
        });
      globalThis.fetch = fn;

      const client = new MauticClient(MOCK_BASE_URL, MOCK_CLIENT_ID, MOCK_CLIENT_SECRET);
      const result = await client.addContactToCampaign(123, 999);

      expect(result).toBe(false);
    });
  });

  describe('Token refresh on 401', () => {
    test('should re-authenticate and retry on 401 response', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockTokenResponse() })
        .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'access_denied', errors: {} }) })
        .mockResolvedValueOnce({ ok: true, json: async () => mockTokenResponse({ access_token: 'refreshed_token_xyz' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ contact: { id: 777 } }) });
      globalThis.fetch = fn;

      const client = new MauticClient(MOCK_BASE_URL, MOCK_CLIENT_ID, MOCK_CLIENT_SECRET);
      const contactId = await client.createOrUpdateContact({ email: 'test@example.com' });

      expect(contactId).toBe(777);
      expect(fn).toHaveBeenCalledTimes(4);
      const lastCall = (fn as any).mock.calls[3];
      expect(lastCall[1].headers.Authorization).toBe('Bearer refreshed_token_xyz');
    });
  });

  describe('Retry logic', () => {
    test('should retry on 5xx server error with exponential backoff and succeed', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockTokenResponse() })
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ contact: { id: 888 } }) });
      globalThis.fetch = fn;

      const client = new MauticClient(MOCK_BASE_URL, MOCK_CLIENT_ID, MOCK_CLIENT_SECRET);
      const contactId = await client.createOrUpdateContact({ email: 'retry@example.com' });

      expect(contactId).toBe(888);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    test('should not retry on 4xx errors other than 401', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockTokenResponse() })
        .mockResolvedValueOnce({
          ok: false,
          status: 422,
          json: async () => ({ error: 'Validation failed', errors: { email: 'Required' } }),
        });
      globalThis.fetch = fn;

      const client = new MauticClient(MOCK_BASE_URL, MOCK_CLIENT_ID, MOCK_CLIENT_SECRET);
      await expect(
        client.createOrUpdateContact({ email: '' })
      ).rejects.toThrow(MauticError);

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('createMauticClient', () => {
    test('should create client from env with all required fields', () => {
      const client = createMauticClient({
        MAUTIC_BASE_URL: MOCK_BASE_URL,
        MAUTIC_CLIENT_ID: MOCK_CLIENT_ID,
        MAUTIC_CLIENT_SECRET: MOCK_CLIENT_SECRET,
      });
      expect(client).toBeInstanceOf(MauticClient);
      expect(client!.baseUrl).toBe(MOCK_BASE_URL);
    });

    test('should return null when MAUTIC_BASE_URL is missing', () => {
      const client = createMauticClient({
        MAUTIC_CLIENT_ID: MOCK_CLIENT_ID,
        MAUTIC_CLIENT_SECRET: MOCK_CLIENT_SECRET,
      });
      expect(client).toBeNull();
    });

    test('should return null when MAUTIC_CLIENT_ID is missing', () => {
      const client = createMauticClient({
        MAUTIC_BASE_URL: MOCK_BASE_URL,
        MAUTIC_CLIENT_SECRET: MOCK_CLIENT_SECRET,
      });
      expect(client).toBeNull();
    });

    test('should return null when MAUTIC_CLIENT_SECRET is missing', () => {
      const client = createMauticClient({
        MAUTIC_BASE_URL: MOCK_BASE_URL,
        MAUTIC_CLIENT_ID: MOCK_CLIENT_ID,
      });
      expect(client).toBeNull();
    });
  });

  describe('Error classes', () => {
    test('MauticError should have name and status', () => {
      const err = new MauticError('API error', 422);
      expect(err.name).toBe('MauticError');
      expect(err.status).toBe(422);
      expect(err.message).toBe('API error');
    });

    test('MauticAuthError should extend MauticError', () => {
      const err = new MauticAuthError('Invalid credentials', 400);
      expect(err).toBeInstanceOf(MauticError);
      expect(err.name).toBe('MauticAuthError');
    });

    test('MauticNetworkError should have name and cause', () => {
      const cause = new TypeError('Failed to fetch');
      const err = new MauticNetworkError('Network failure', cause);
      expect(err.name).toBe('MauticNetworkError');
      expect(err.cause).toBe(cause);
    });

    test('MauticNetworkError should default cause to null', () => {
      const err = new MauticNetworkError('Network failure');
      expect(err.cause).toBeNull();
    });
  });
});
