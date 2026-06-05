/** * Jest Test Setup for AURA CAFE */

// Capture real fs.readFileSync BEFORE any test file mocks it
const _realFs = require('fs');
const REAL_READ_FILE_SYNC = _realFs.readFileSync;
global.REAL_READ_FILE_SYNC = REAL_READ_FILE_SYNC;

// Mock global fetch
global.fetch = jest.fn();

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
