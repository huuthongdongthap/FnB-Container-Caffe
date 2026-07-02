/**
 * Channel Module Tests — TDD
 */
import { describe, it, expect } from 'vitest';
import { renderTemplate } from '../../templates';
import type { CampaignTrigger } from '../../types';

describe('templates', () => {
  it('renders welcome template with customer name', () => {
    const result = renderTemplate('welcome', 'Nguyen Van A');
    expect(result.sms).toContain('Nguyen Van A');
    expect(result.sms).toContain('WELCOME10');
  });

  it('renders birthday template with discount', () => {
    const result = renderTemplate('birthday', 'Tran Thi B');
    expect(result.sms).toContain('Tran Thi B');
    expect(result.sms).toContain('15%');
  });

  it('renders winback template', () => {
    const result = renderTemplate('winback', 'Le Van C');
    expect(result.sms).toContain('Le Van C');
    expect(result.sms).toContain('15%');
  });

  it('renders post_visit template', () => {
    const result = renderTemplate('post_visit', 'Pham Van D');
    expect(result.sms).toContain('Pham Van D');
    expect(result.sms).toContain('Danh gia');
  });

  it('renders cashback_expiry template with amount and days', () => {
    const result = renderTemplate('cashback_expiry', 'Hoang Van E', { amount: 50000, days_left: 7 });
    expect(result.sms).toContain('Hoang Van E');
    expect(result.sms).toContain('50.000');
    expect(result.sms).toContain('7');
  });

  it('renders email subject for each trigger type', () => {
    const triggers: CampaignTrigger[] = ['welcome', 'birthday', 'winback', 'post_visit', 'cashback_expiry'];
    for (const t of triggers) {
      const result = renderTemplate(t, 'Test User');
      expect(result.subject).toBeTruthy();
      expect(result.html).toBeTruthy();
    }
  });

  it('handles missing name with fallback', () => {
    const result = renderTemplate('welcome', undefined);
    expect(result.sms).toContain('ban');
  });
});
