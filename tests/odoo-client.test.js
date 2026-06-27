/**
 * Odoo Client Unit Tests — Phase 1 (Accounting)
 */

const { OdooClient, NetworkError, OdooError, MalformedResponseError } = require('../worker/src/clients/odoo-client.js');

const mockOdooResponse = (result, id = 1) => ({
  jsonrpc: '2.0',
  id,
  result
});

const mockOdooError = (message, code = 'odoo_error', id = 1) => ({
  jsonrpc: '2.0',
  id,
  error: {
    code,
    message,
    data: {}
  }
});

const MOCK_CONFIG = {
  url: 'https://odoo.example.com',
  db: 'test_db',
  username: 'test_user',
  apiKey: 'test_api_key',
};

describe('OdooClient — Phase 1 (Accounting)', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('Constructor Validation', () => {
    test('should throw if url is missing', () => {
      expect(() => new OdooClient({ db: MOCK_CONFIG.db, username: MOCK_CONFIG.username, apiKey: MOCK_CONFIG.apiKey }))
        .toThrow('OdooClient: url is required');
    });

    test('should throw if db is missing', () => {
      expect(() => new OdooClient({ url: MOCK_CONFIG.url, username: MOCK_CONFIG.username, apiKey: MOCK_CONFIG.apiKey }))
        .toThrow('OdooClient: db is required');
    });

    test('should throw if username is missing', () => {
      expect(() => new OdooClient({ url: MOCK_CONFIG.url, db: MOCK_CONFIG.db, apiKey: MOCK_CONFIG.apiKey }))
        .toThrow('OdooClient: username is required');
    });

    test('should throw if apiKey is missing', () => {
      expect(() => new OdooClient({ url: MOCK_CONFIG.url, db: MOCK_CONFIG.db, username: MOCK_CONFIG.username }))
        .toThrow('OdooClient: apiKey is required');
    });

    test('should strip trailing slash from URL', () => {
      const c = new OdooClient({ ...MOCK_CONFIG, url: 'https://odoo.example.com/' });
      expect(c.url).toBe('https://odoo.example.com');
    });
  });

  describe('Authentication', () => {
    test('should authenticate and set uid', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockOdooResponse(123),
      });

      const client = new OdooClient(MOCK_CONFIG);
      const uid = await client.authenticate();

      expect(uid).toBe(123);
      expect(client.uid).toBe(123);
    });

    test('should cache authentication', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockOdooResponse(123),
      });

      const client = new OdooClient(MOCK_CONFIG);
      await client.authenticate();
      await client.authenticate();

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('should handle authentication failure with Odoo error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockOdooError('Invalid credentials', 'odoo_auth_failed'),
      });

      const client = new OdooClient(MOCK_CONFIG);

      await expect(client.authenticate()).rejects.toThrow('Invalid credentials');
    });

    test('should handle network failure during authentication', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const client = new OdooClient(MOCK_CONFIG);

      await expect(client.authenticate()).rejects.toThrow('Network error');
    });

    test('should throw on invalid UID response (null)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockOdooResponse(null),
      });

      const client = new OdooClient(MOCK_CONFIG);

      await expect(client.authenticate()).rejects.toThrow('Odoo authentication failed: invalid uid null');
    });

    test('should throw on invalid UID response (0)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockOdooResponse(0),
      });

      const client = new OdooClient(MOCK_CONFIG);

      await expect(client.authenticate()).rejects.toThrow('Odoo authentication failed: invalid uid 0');
    });
  });

  describe('CRUD Operations', () => {
    let client;

    beforeEach(async () => {
      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse(123) });

      client = new OdooClient(MOCK_CONFIG);
      await client.authenticate();
    });

    test('should create record and return ID', async () => {
      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse(12345) });

      const result = await client.create('account.move', { name: 'INV/001' });

      expect(result).toBe(12345);
    });

    test('should throw if create returns non-number', async () => {
      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse('not-a-number') });

      await expect(client.create('account.move', {})).rejects.toThrow('Odoo create expected number ID, got string');
    });

    test('should read records by IDs', async () => {
      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse([{ id: 1, name: 'INV/001' }]) });

      const result = await client.read('account.move', [1], ['name']);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    test('should return empty array for non-existent records', async () => {
      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse([]) });

      const result = await client.read('account.move', [999]);

      expect(result).toEqual([]);
    });

    test('should update records and return true', async () => {
      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse(true) });

      const result = await client.update('account.move', 123, { state: 'posted' });

      expect(result).toBe(true);
    });

    test('should searchRead with domain and fields', async () => {
      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse([{ id: 1, name: 'INV/001' }]) });

      const result = await client.searchRead('account.move', [['state', '=', 'draft']], ['name']);

      expect(result).toHaveLength(1);
    });

    test('should search for record IDs', async () => {
      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse([1, 2, 3]) });

      const result = await client.search('account.move', [['state', '=', 'open']]);

      expect(result).toEqual([1, 2, 3]);
    });

    test('should unlink records', async () => {
      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse(true) });

      const result = await client.unlink('account.move', [1, 2, 3]);

      expect(result).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should propagate Odoo API errors', async () => {
      const client = new OdooClient(MOCK_CONFIG);

      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse(123) });

      // Wait for auth
      await client.authenticate();

      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooError('Access denied', 'ACCESS_DENIED') });

      await expect(client.create('account.move', {})).rejects.toThrow('Odoo error [ACCESS_DENIED]: Access denied');
    });

    test('should handle HTTP errors', async () => {
      const client = new OdooClient(MOCK_CONFIG);

      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse(123) });

      await client.authenticate();

      global.fetch = jest.fn()
        .mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });

      await expect(client.create('account.move', {})).rejects.toThrow('HTTP 500: Internal Server Error');
    });

    test('should handle malformed JSON-RPC response', async () => {
      const client = new OdooClient(MOCK_CONFIG);

      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse(123) });

      await client.authenticate();

      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => ({ invalid: 'response' }) });

      await expect(client.create('account.move', {})).rejects.toThrow('Odoo create expected number ID, got undefined');
    });

    test('should handle JSON parse failure', async () => {
      const client = new OdooClient(MOCK_CONFIG);

      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse(123) });

      await client.authenticate();

      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } });

      await expect(client.create('account.move', {})).rejects.toThrow('Invalid JSON');
    });

    test('should handle request timeout', async () => {
      const client = new OdooClient(MOCK_CONFIG);

      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse(123) });

      await client.authenticate();

      global.fetch = jest.fn()
        .mockRejectedValue(new TypeError('The user aborted a request.'));

      await expect(client.create('account.move', {})).rejects.toThrow('The user aborted a request.');
    });
  });

  describe('Retry Logic', () => {
    test('should retry on network error and succeed', async () => {
      const client = new OdooClient({ ...MOCK_CONFIG, maxAttempts: 3 });

      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse(123) });

      await client.authenticate();

      // First call fails with network error, second succeeds
      global.fetch = jest.fn()
        .mockRejectedValue(new TypeError('Network error'))
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse(12345) });

      const result = await client.create('account.move', {});

      expect(result).toBe(12345);
    }, 10000);

    test('should give up after max attempts on network error', async () => {
      const client = new OdooClient({ ...MOCK_CONFIG, maxAttempts: 2 });

      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse(123) });

      await client.authenticate();

      global.fetch = jest.fn()
        .mockRejectedValue(new TypeError('Network error'))
        .mockRejectedValue(new TypeError('Network error'));

      await expect(client.create('account.move', {})).rejects.toThrow('Network error');
    }, 10000);

    test('should handle undefined arguments', async () => {
      const client = new OdooClient(MOCK_CONFIG);

      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse(123) });

      await client.authenticate();

      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse(456) });

      const result = await client.create('account.move', undefined);

      expect(result).toBe(456);
    });
  });

  describe('Error Classes', () => {
    test('NetworkError should have name and statusCode', () => {
      const err = new NetworkError('Connection failed', 503);
      expect(err.name).toBe('NetworkError');
      expect(err.statusCode).toBe(503);
      expect(err.message).toBe('Connection failed');
    });

    test('OdooError should have code and data', () => {
      const err = new OdooError('Test error', 'TEST_CODE', { debug: 'trace' });
      expect(err.name).toBe('OdooError');
      expect(err.code).toBe('TEST_CODE');
      expect(err.data).toEqual({ debug: 'trace' });
    });

    test('MalformedResponseError should have originalError', () => {
      const original = new Error('Original');
      const err = new MalformedResponseError('Malformed', original);
      expect(err.name).toBe('MalformedResponseError');
      expect(err.originalError).toBe(original);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty searchRead result', async () => {
      const client = new OdooClient(MOCK_CONFIG);

      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse(123) });

      await client.authenticate();

      global.fetch = jest.fn()
        .mockResolvedValue({ ok: true, json: async () => mockOdooResponse([]) });

      const result = await client.searchRead('account.move', [], []);

      expect(result).toEqual([]);
    });
  });
});

describe('OdooClient — Helper Methods', () => {
  let client;
  let originalFetch;

  const mockUrl = 'https://odoo.example.com';
  const mockDb = 'test_db';
  const mockUser = 'test_user';
  const mockApiKey = 'test_api_key';

  beforeEach(async () => {
    originalFetch = global.fetch;
    jest.clearAllMocks();

    global.fetch = jest.fn()
      .mockResolvedValue({ ok: true, json: async () => mockOdooResponse(123) });

    client = new OdooClient({ url: mockUrl, db: mockDb, username: mockUser, apiKey: mockApiKey });
    await client.authenticate();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('_generateRequestId', () => {
    test('should generate unique IDs with correct format', () => {
      const id1 = client._generateRequestId();
      const id2 = client._generateRequestId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });

  describe('sleep', () => {
    test('should resolve after specified time', async () => {
      jest.useFakeTimers();
      const sleepPromise = client.sleep(1000);

      await jest.advanceTimersByTimeAsync(1000);
      await sleepPromise;

      jest.useRealTimers();
    });
  });

  describe('isRetryableError', () => {
    test('should return true for retryable Odoo codes', () => {
      const err = new OdooError('Timeout', 'odoo_retry');
      expect(client.isRetryableError(err)).toBe(true);
    });

    test('should return false for non-retryable codes', () => {
      const err = new OdooError('Access denied', 'ACCESS_DENIED');
      expect(client.isRetryableError(err)).toBe(false);
    });

    test('should return false for null/undefined', () => {
      expect(client.isRetryableError(null)).toBe(false);
      expect(client.isRetryableError(undefined)).toBe(false);
    });

    test('should check odooCode from parsed errors', () => {
      const err = { odooCode: 'odoo_retry', odooData: {} };
      expect(client.isRetryableError(err)).toBe(true);
    });
  });

  describe('isNetworkError', () => {
    test('should identify TypeError as network error', () => {
      const err = new TypeError('Failed to fetch');
      expect(client.isNetworkError(err)).toBe(true);
    });

    test('should identify NetworkError class', () => {
      const err = new NetworkError('Connection lost');
      expect(client.isNetworkError(err)).toBe(true);
    });

    test('should identify network-related messages', () => {
      const err = new Error('Network error: connection reset');
      expect(client.isNetworkError(err)).toBe(true);
    });

    test('should return false for non-network errors', () => {
      const err = new OdooError('Business logic error');
      expect(client.isNetworkError(err)).toBe(false);
    });
  });

  describe('calculateDelay', () => {
    test('should calculate exponential backoff', () => {
      const delay1 = client.calculateDelay(0);
      const delay2 = client.calculateDelay(1);
      const delay3 = client.calculateDelay(2);

      expect(delay1).toBeGreaterThanOrEqual(750);
      expect(delay2).toBeGreaterThanOrEqual(1500);
      expect(delay3).toBeGreaterThanOrEqual(3000);
    });

    test('should cap at maxDelay', () => {
      const delay = client.calculateDelay(10);
      expect(delay).toBeLessThanOrEqual(10000);
    });
  });
});
