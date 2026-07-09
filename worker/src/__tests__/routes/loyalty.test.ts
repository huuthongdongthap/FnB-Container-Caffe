/**
 * Unit tests for loyalty routes
 * Tests processOrderLoyalty directly (exported function).
 */

import { describe, it, expect } from 'vitest';
import { processOrderLoyalty } from '../../routes/loyalty';
import { TEST_JWT_SECRET, createMockEnv, createMockKV } from '../test-utils';

describe('processOrderLoyalty', () => {
  it('returns failure for missing order', async() => {
    const env = createMockEnv();
    const result = await processOrderLoyalty('ORD_1', env);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('order_not_found');
  });

  it('handles invalid order gracefully', async() => {
    const env = createMockEnv();
    const result = await processOrderLoyalty('ORD_MISSING', env);
    expect(result.ok).toBe(false);
  });
});
