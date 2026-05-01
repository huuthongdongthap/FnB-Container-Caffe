/**
 * Jest Test Setup for AURA CAFE
 */

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
