/**
 * ERPNext Client Unit Tests — Phase 1
 *
 * Tests for ErpnextClient REST API wrapper for Frappe/ERPNext.
 * Follows same structure as odoo-client.test.js but for REST instead of JSON-RPC.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  ErpnextClient,
  ErpnextError,
  NetworkError,
  MalformedResponseError,
  createErpnextClient,
} from '../worker/src/clients/erpnext-client.ts';

const mockFrappeListResponse = (data: unknown) => ({ data });
const mockFrappeSingleResponse = (data: unknown) => ({ data });
const mockFrappeError = (excType: string, message: string) => ({
  exc_type: excType,
  _server_messages: JSON.stringify([JSON.stringify({ message })])
});

const MOCK_CONFIG = {
  url: 'https://erpnext.example.com',
  apiKey: 'test_key',
  apiSecret: 'test_secret',
};

describe('ErpnextClient', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  describe('Constructor & Factory', () => {
    test('should create client with valid config', () => {
      const client = new ErpnextClient(MOCK_CONFIG);
      expect(client.url).toBe('https://erpnext.example.com');
      expect(client.apiKey).toBe('test_key');
      expect(client.apiSecret).toBe('test_secret');
    });

    test('should strip trailing slash from URL', () => {
      const client = new ErpnextClient({ ...MOCK_CONFIG, url: 'https://erpnext.example.com/' });
      expect(client.url).toBe('https://erpnext.example.com');
    });

    test('createErpnextClient should return null when ERPNEXT_URL is missing', () => {
      const result = createErpnextClient({ ERPNEXT_API_KEY: 'k', ERPNEXT_API_SECRET: 's' });
      expect(result).toBeNull();
    });

    test('createErpnextClient should return null when ERPNEXT_API_KEY is missing', () => {
      const result = createErpnextClient({ ERPNEXT_URL: 'https://example.com', ERPNEXT_API_SECRET: 's' });
      expect(result).toBeNull();
    });

    test('createErpnextClient should return null when ERPNEXT_API_SECRET is missing', () => {
      const result = createErpnextClient({ ERPNEXT_URL: 'https://example.com', ERPNEXT_API_KEY: 'k' });
      expect(result).toBeNull();
    });

    test('createErpnextClient should return client when all env vars present', () => {
      const result = createErpnextClient({
        ERPNEXT_URL: 'https://erpnext.example.com',
        ERPNEXT_API_KEY: 'test_key',
        ERPNEXT_API_SECRET: 'test_secret',
      });
      expect(result).toBeInstanceOf(ErpnextClient);
      expect(result!.url).toBe('https://erpnext.example.com');
    });
  });

  describe('Authentication', () => {
    test('should include Authorization header with token format', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockFrappeSingleResponse({ name: 'CUST-001' }),
      });

      const client = new ErpnextClient(MOCK_CONFIG);
      await client.read('Customer', 'CUST-001');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/resource/Customer/CUST-001'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'token test_key:test_secret',
          }),
        })
      );
    });

    test('should send Content-Type application/json for POST', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockFrappeSingleResponse({ name: 'INV-001' }),
      });

      const client = new ErpnextClient(MOCK_CONFIG);
      await client.create('Sales Invoice', { customer: 'CUST-001' });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          method: 'POST',
        })
      );
    });

    test('getAuthHeader should return correct token format', () => {
      const client = new ErpnextClient(MOCK_CONFIG);
      expect(client.getAuthHeader()).toBe('token test_key:test_secret');
    });
  });

  describe('CRUD Operations', () => {
    let client: ErpnextClient;

    beforeEach(() => {
      client = new ErpnextClient(MOCK_CONFIG);
    });

    test('should create record via POST /api/resource/{doctype}', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockFrappeSingleResponse({ name: 'INV-001', customer: 'CUST-001' }),
      });

      const result = await client.create('Sales Invoice', { customer: 'CUST-001', items: [] });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://erpnext.example.com/api/resource/Sales%20Invoice',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"customer":"CUST-001"'),
        })
      );
      expect(result.data).toEqual({ name: 'INV-001', customer: 'CUST-001' });
    });

    test('should read record via GET /api/resource/{doctype}/{name}', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockFrappeSingleResponse({ name: 'CUST-001', customer_name: 'Test Customer' }),
      });

      const result = await client.read('Customer', 'CUST-001');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://erpnext.example.com/api/resource/Customer/CUST-001',
        expect.objectContaining({ method: 'GET' })
      );
      expect(result.data.name).toBe('CUST-001');
    });

    test('should update record via PUT /api/resource/{doctype}/{name}', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockFrappeSingleResponse({ name: 'CUST-001', customer_name: 'Updated' }),
      });

      const result = await client.update('Customer', 'CUST-001', { customer_name: 'Updated' });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://erpnext.example.com/api/resource/Customer/CUST-001',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"customer_name":"Updated"'),
        })
      );
      expect(result.data.customer_name).toBe('Updated');
    });

    test('should delete record via DELETE /api/resource/{doctype}/{name}', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'ok', data: { name: 'CUST-001' } }),
      });

      const result = await client.delete('Customer', 'CUST-001');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://erpnext.example.com/api/resource/Customer/CUST-001',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result).toBeDefined();
    });

    test('should list records via GET /api/resource/{doctype}', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockFrappeListResponse([{ name: 'CUST-001' }, { name: 'CUST-002' }]),
      });

      const result = await client.list('Customer', { fields: ['name', 'customer_name'] });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/resource/Customer'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('fields='),
        expect.any(Object)
      );
      expect(result.data).toHaveLength(2);
    });

    test('should list with filters as JSON string param', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockFrappeListResponse([{ name: 'CUST-001' }]),
      });

      await client.list('Customer', {
        filters: [['customer_name', 'like', '%Test%']],
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent('[["customer_name","like","%Test%"]]')),
        expect.any(Object)
      );
    });

    test('should list with pagination params', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockFrappeListResponse([{ name: 'CUST-001' }]),
      });

      await client.list('Customer', { limit: 10, offset: 20 });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit_page_length=10'),
        expect.any(Object)
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit_start=20'),
        expect.any(Object)
      );
    });

    test('should list with no params and not append empty query string', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockFrappeListResponse([]),
      });

      await client.list('Customer');

      const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(calledUrl).toBe('https://erpnext.example.com/api/resource/Customer');
    });
  });

  describe('searchModified', () => {
    let client: ErpnextClient;

    beforeEach(() => {
      client = new ErpnextClient(MOCK_CONFIG);
    });

    test('should filter by modified > since timestamp with .0 suffix', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockFrappeListResponse([{ name: 'CUST-001', modified: '2026-06-30 12:00:00.0' }]),
      });

      const result = await client.searchModified('Customer', '2026-06-30 10:00:00');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filters='),
        expect.objectContaining({ method: 'GET' })
      );
      // Verify the URL contains properly encoded filter with .0 suffix
      const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(calledUrl).toContain('modified');
      expect(calledUrl).toContain('%3E');
      expect(calledUrl).toContain('10%3A00%3A00.0');
      expect(result.data).toHaveLength(1);
    });

    test('should not add .0 suffix if already present', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockFrappeListResponse([]),
      });

      await client.searchModified('Customer', '2026-06-30 10:00:00.0');

      const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(calledUrl).toContain('10%3A00%3A00.0');
      // Should have exactly one occurrence of .0
      expect(calledUrl.match(/\.0/g)).toHaveLength(1);
    });

    test('should use default fields [name, modified]', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockFrappeListResponse([]),
      });

      await client.searchModified('Customer', '2026-06-30 10:00:00');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent('["name","modified"]')),
        expect.any(Object)
      );
    });

    test('should use custom fields when provided', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockFrappeListResponse([]),
      });

      await client.searchModified('Customer', '2026-06-30 10:00:00', ['name', 'modified', 'customer_name']);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent('["name","modified","customer_name"]')),
        expect.any(Object)
      );
    });

    test('should default to limit 100', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockFrappeListResponse([]),
      });

      await client.searchModified('Customer', '2026-06-30 10:00:00');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit_page_length=100'),
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    let client: ErpnextClient;

    beforeEach(() => {
      client = new ErpnextClient(MOCK_CONFIG);
    });

    test('should throw ErpnextError on API error response with exc_type', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => mockFrappeError('FrappeValidationError', 'Invalid customer'),
      });

      await expect(client.read('Customer', 'INVALID')).rejects.toThrow(ErpnextError);
    });

    test('should throw ErpnextError with status and excType', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          exc_type: 'FrappePermissionError',
          _server_messages: JSON.stringify([JSON.stringify({ message: 'Not permitted' })]),
        }),
      });

      try {
        await client.read('Customer', 'SECRET');
        expect('should have thrown').toBe('never');
      } catch (err) {
        expect(err).toBeInstanceOf(ErpnextError);
        expect((err as ErpnextError).status).toBe(200);
        expect((err as ErpnextError).excType).toBe('FrappePermissionError');
      }
    });

    test('should throw ErpnextError with exc field (alternative format)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          exc: 'Traceback (most recent call last):\n  File "frappe/app.py", line...',
        }),
      });

      await expect(client.read('Customer', 'CUST-001')).rejects.toThrow(ErpnextError);
    });

    test('should handle 401 unauthorized', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ exc_type: 'AuthenticationError', _server_messages: '[]' }),
      });

      await expect(client.read('Customer', 'CUST-001')).rejects.toThrow(ErpnextError);
    });

    test('should handle 403 forbidden', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ exc_type: 'PermissionError' }),
      });

      await expect(client.read('Customer', 'CUST-001')).rejects.toThrow(ErpnextError);
    });

    test('should throw NetworkError on fetch failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(client.list('Customer')).rejects.toThrow(NetworkError);
    });

    test('should throw MalformedResponseError for non-JSON response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError('Unexpected token < in JSON'); },
      });

      await expect(client.read('Customer', 'CUST-001')).rejects.toThrow(MalformedResponseError);
    });

    test('should timeout after configured timeout', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('The user aborted a request.'));

      await expect(client.read('Customer', 'CUST-001')).rejects.toThrow(NetworkError);
    });

    test('should handle empty response body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      const result = await client.list('Customer');
      expect(result).toEqual({});
    });
  });

  describe('Retry Logic', () => {
    let client: ErpnextClient;

    beforeEach(() => {
      client = new ErpnextClient({ ...MOCK_CONFIG, maxRetries: 3 });
    });

    test('should retry on 429 rate limit and succeed', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFrappeSingleResponse({ name: 'CUST-001' }),
        });

      const result = await client.read('Customer', 'CUST-001');
      expect(result.data.name).toBe('CUST-001');
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    }, 10000);

    test('should retry on 5xx server error and succeed', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFrappeSingleResponse({ name: 'CUST-001' }),
        });

      const result = await client.read('Customer', 'CUST-001');
      expect(result.data.name).toBe('CUST-001');
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    }, 10000);

    test('should give up after max retries', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

      await expect(client.read('Customer', 'CUST-001')).rejects.toThrow(ErpnextError);
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    }, 10000);

    test('should retry on network error and succeed', async () => {
      globalThis.fetch = vi.fn()
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFrappeSingleResponse({ name: 'CUST-001' }),
        });

      const result = await client.read('Customer', 'CUST-001');
      expect(result.data.name).toBe('CUST-001');
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    }, 10000);

    test('should not retry on 400 bad request', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValue({ ok: false, status: 400, json: async () => ({ exc_type: 'ValidationError' }) });

      await expect(client.read('Customer', 'INVALID')).rejects.toThrow(ErpnextError);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    test('should not retry on 401 unauthorized', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValue({ ok: false, status: 401, json: async () => ({ exc_type: 'AuthenticationError' }) });

      await expect(client.read('Customer', 'CUST-001')).rejects.toThrow(ErpnextError);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Classes', () => {
    test('ErpnextError should have name, status, excType', () => {
      const err = new ErpnextError('API error', 400, 'ValidationError');
      expect(err.name).toBe('ErpnextError');
      expect(err.status).toBe(400);
      expect(err.excType).toBe('ValidationError');
      expect(err.message).toBe('API error');
    });

    test('ErpnextError should default excType to empty string', () => {
      const err = new ErpnextError('Generic error', 500);
      expect(err.excType).toBe('');
    });

    test('NetworkError should have name and cause', () => {
      const cause = new Error('Connection refused');
      const err = new NetworkError('Network failure', cause);
      expect(err.name).toBe('NetworkError');
      expect(err.cause).toBe(cause);
    });

    test('NetworkError should default cause to null', () => {
      const err = new NetworkError('Network failure');
      expect(err.cause).toBeNull();
    });

    test('MalformedResponseError should have name and body', () => {
      const body = '<html>not json</html>';
      const err = new MalformedResponseError('Invalid JSON', body);
      expect(err.name).toBe('MalformedResponseError');
      expect(err.body).toBe(body);
    });
  });

  describe('Specific ERPNext Doctypes', () => {
    let client: ErpnextClient;

    beforeEach(() => {
      client = new ErpnextClient(MOCK_CONFIG);
    });

    test('createInvoice should create Sales Invoice', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockFrappeSingleResponse({ name: 'SINV-001', customer: 'CUST-001' }),
      });

      const orderData = {
        customer: 'CUST-001',
        items: [{ item_code: 'CF001', qty: 2, rate: 50000 }],
        posting_date: '2026-06-30',
      };

      const result = await client.createInvoice(orderData);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://erpnext.example.com/api/resource/Sales%20Invoice',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('CUST-001'),
        })
      );
      expect(result.data.name).toBe('SINV-001');
    });

    test('getProductAvailability should query Item and Bin', async () => {
      // First call: get item
      // Second call: get bin for warehouse stock
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFrappeSingleResponse({ name: 'CF001', item_name: 'Coffee' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFrappeListResponse([
            { warehouse: 'Store', actual_qty: 50 },
            { warehouse: 'Kitchen', actual_qty: 20 },
          ]),
        });

      const result = await client.getProductAvailability('CF001');

      expect(result.item.name).toBe('CF001');
      expect(result.stock).toHaveLength(2);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    test('getProductAvailability should handle missing item', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ exc_type: 'DoesNotExistError' }) });

      await expect(client.getProductAvailability('INVALID')).rejects.toThrow(ErpnextError);
    });
  });
});
