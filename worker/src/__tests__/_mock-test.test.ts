import { describe, it, expect, vi } from 'vitest';

// Mock BEFORE any import that chains to middleware/auth
vi.mock('../middleware/auth', () => ({
  requireAuth: () => async() => {}
}));

describe('mock test', () => {
  it('verify mock intercepts auth', async() => {
    // Dynamic import — vitest hoists vi.mock() to top
    const mod = (await import('../middleware/auth')) as any;
    expect(mod.requireAuth.toString()).toContain('async');
  });
});
