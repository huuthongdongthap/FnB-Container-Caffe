/**
 * Vitest setup for worker test migration.
 * Mocks that break the TS import chain BEFORE any test runs.
 */
import { vi } from 'vitest';
import { TextEncoder, TextDecoder } from 'util';

// Worker polyfills
globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;

// Mock logger — breaks the TS import chain for ALL worker tests
vi.mock('../worker/src/middleware/logger.ts', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  })),
  newRequestId: vi.fn(() => 'r_test_' + Date.now().toString(36)),
}));

// Browser globals for jsdom
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof IntersectionObserver;
