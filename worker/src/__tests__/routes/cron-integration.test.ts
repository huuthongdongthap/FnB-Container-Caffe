/**
 * Cron Integration Tests — Phase 4
 * Verify campaign cron handlers are wired correctly
 */
import { describe, it, expect } from 'vitest';
import { createMockEnv, createMockDB } from '../test-utils';

describe('cron exports', () => {
  it('exports runCampaignTriggers from routes/cron', async() => {
    const cron = await import('../../routes/cron');
    expect(typeof cron.runCampaignTriggers).toBe('function');
  });

  it('runCampaignTriggers returns counts without throwing', async() => {
    const cron = await import('../../routes/cron');
    const env = createMockEnv();
    const result = await cron.runCampaignTriggers(env);
    expect(result).toHaveProperty('triggered');
    expect(result).toHaveProperty('sent');
    expect(typeof result.triggered).toBe('number');
    expect(typeof result.sent).toBe('number');
  });

  it('exports existing cron functions alongside new ones', async() => {
    const cron = await import('../../routes/cron');
    expect(typeof cron.checkOverdueOrders).toBe('function');
    expect(typeof cron.sendCashbackExpiryWarnings).toBe('function');
    expect(typeof cron.processErpnextRetryQueue).toBe('function');
    expect(typeof cron.processErpnextProductSync).toBe('function');
    expect(typeof cron.runCampaignTriggers).toBe('function');
  });
});

describe('index registration', () => {
  it('runCampaignTriggers is importable from routes/cron', async() => {
    const cron = await import('../../routes/cron');
    // Verify it's a named export
    expect(Object.keys(cron)).toContain('runCampaignTriggers');
  });
});
