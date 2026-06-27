/** * Jest Test Setup for AURA CAFE */

// Cloudflare Workers polyfill for Jest (Response, Request, Headers, fetch)
// Minimal implementation for testing Worker routes

class HeadersMock {
  constructor(init) {
    this._headers = new Map();
    if (init instanceof HeadersMock) {
      init.forEach((value, key) => this.set(key, value));
    } else if (init && typeof init === 'object') {
      Object.entries(init).forEach(([key, value]) => this.set(key, value));
    }
  }

  append(key, value) {
    this._headers.set(key.toLowerCase(), String(value));
  }

  delete(key) {
    this._headers.delete(key.toLowerCase());
  }

  get(key) {
    return this._headers.get(key.toLowerCase()) || null;
  }

  has(key) {
    return this._headers.has(key.toLowerCase());
  }

  set(key, value) {
    this._headers.set(key.toLowerCase(), String(value));
  }

  forEach(callback, thisArg) {
    this._headers.forEach((value, key) => callback.call(thisArg, value, key, this));
  }

  keys() {
    return this._headers.keys();
  }

  values() {
    return this._headers.values();
  }

  entries() {
    return this._headers.entries();
  }

  [Symbol.iterator]() {
    return this._headers.entries();
  }
}

class RequestMock {
  constructor(input, init = {}) {
    this._url = typeof input === 'string' ? input : input.url;
    this._method = init.method || (input && input.method) || 'GET';
    this._headers = new HeadersMock(init.headers || (input && input.headers));
    this._body = init.body || (input && input.body) || null;
  }

  get method() {
    return this._method;
  }

  get url() {
    return this._url;
  }

  get headers() {
    return this._headers;
  }

  get body() {
    return this._body;
  }

  async json() {
    if (!this._body) return null;
    if (typeof this._body === 'string') {
      return JSON.parse(this._body);
    }
    return this._body;
  }

  async text() {
    if (!this._body) return '';
    return typeof this._body === 'string' ? this._body : JSON.stringify(this._body);
  }

  async blob() {
    // Simplified blob for tests
    return new Blob([this.text()]);
  }

  async arrayBuffer() {
    const text = await this.text();
    return new TextEncoder().encode(text).buffer;
  }

  async formData() {
    throw new Error('formData() not implemented in mock');
  }
}

class ResponseMock {
  constructor(body, init = {}) {
    this._body = body;
    this._status = init.status || 200;
    this._statusText = init.statusText || '';
    this._headers = new HeadersMock(init.headers);

    // Handle body as string, object, or null
    if (body !== null && typeof body === 'object' && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) {
      this._bodyString = JSON.stringify(body);
    } else {
      this._bodyString = body;
    }
  }

  get status() {
    return this._status;
  }

  get statusText() {
    return this._statusText;
  }

  get headers() {
    return this._headers;
  }

  async json() {
    if (this._bodyString === null || this._bodyString === undefined) return null;
    return JSON.parse(this._bodyString);
  }

  async text() {
    return this._bodyString || '';
  }

  async blob() {
    return new Blob([this._bodyString || '']);
  }

  async arrayBuffer() {
    const text = await this.text();
    return new TextEncoder().encode(text).buffer;
  }
}

// Capture real fs.readFileSync BEFORE any test file mocks it
const _realFs = require('fs');
const REAL_READ_FILE_SYNC = _realFs.readFileSync;
global.REAL_READ_FILE_SYNC = REAL_READ_FILE_SYNC;

// Set up Cloudflare Workers globals
global.Response = ResponseMock;
global.Request = RequestMock;
global.Headers = HeadersMock;

// Mock global fetch (returns a Response mock by default)
global.fetch = jest.fn(async (input, init) => {
  return new ResponseMock(null, { status: 200 });
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock localStorage
const localStorageMock = {
  store: {},
  clear() {
    this.store = {};
  },
  getItem(key) {
    return this.store[key] || null;
  },
  setItem(key, value) {
    this.store[key] = String(value);
  },
  removeItem(key) {
    delete this.store[key];
  },
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock window.matchMedia
Object.defineProperty(global, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
});

// Restore all mocks after each test suite (auto-cleanup for jest.spyOn)
// NOTE: removed from beforeEach — each test file handles its own afterAll cleanup
// to keep fs.readFileSync spy active for the entire file
