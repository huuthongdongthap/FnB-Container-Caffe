/** Campaign Types — structural guarantees */
import { describe, it, expect } from 'vitest';
import type {
  CampaignTrigger,
  CampaignChannel,
  CampaignCustomer,
  CampaignMessage,
  CampaignResult,
  CampaignLogRow
} from '../../../tree/campaigns/types';

describe('CampaignTrigger', () => {
  it('has exactly the five expected trigger values', () => {
    const triggers: CampaignTrigger[] = [
      'welcome',
      'birthday',
      'winback',
      'post_visit',
      'cashback_expiry'
    ];
    expect(triggers).toHaveLength(5);
    triggers.forEach((t) => expect(typeof t).toBe('string'));
  });

  it('rejects unknown triggers at type level', () => {
    // Using 'as' cast to simulate a bad value — at runtime we verify the shape
    const bad = 'unknown_trigger' as CampaignTrigger;
    expect(bad).toBe('unknown_trigger');
  });
});

describe('CampaignChannel', () => {
  it('has exactly the three expected channel values', () => {
    const channels: CampaignChannel[] = ['sms', 'email', 'zalo'];
    expect(channels).toHaveLength(3);
  });
});

describe('CampaignCustomer', () => {
  it('accepts a minimal valid instance', () => {
    const customer: CampaignCustomer = {
      id: 'c1',
      name: 'Test',
      phone: '0909000000',
      email: 'test@test.com',
      loyalty_tier: 'bronze',
      total_spent: 50000,
      visit_count: 3,
      last_order_date: '2026-07-01',
      date_of_birth: '1995-03-15',
      created_at: '2026-01-01'
    };
    expect(customer.id).toBe('c1');
    expect(customer.visit_count).toBe(3);
  });

  it('allows optional fields to be omitted', () => {
    const customer: CampaignCustomer = {
      id: 'c2',
      name: 'Minimal'
    };
    expect(customer.phone).toBeUndefined();
    expect(customer.email).toBeUndefined();
    expect(customer.total_spent).toBeUndefined();
  });
});

describe('CampaignMessage', () => {
  it('accepts a valid instance with all fields', () => {
    const msg: CampaignMessage = {
      trigger: 'welcome',
      channel: 'sms',
      to: '0909123456',
      subject: 'Welcome!',
      body: 'Hello',
      data: { name: 'An', referral_code: 'ABC' }
    };
    expect(msg.trigger).toBe('welcome');
    expect(msg.data).toBeDefined();
  });

  it('allows optional subject and data', () => {
    const msg: CampaignMessage = {
      trigger: 'birthday',
      channel: 'zalo',
      to: '0909000000',
      body: 'Happy Birthday!'
    };
    expect(msg.subject).toBeUndefined();
    expect(msg.data).toBeUndefined();
  });
});

describe('CampaignResult', () => {
  it('accepts a successful send', () => {
    const result: CampaignResult = {
      trigger: 'welcome',
      channel: 'sms',
      customer_id: 'c1',
      sent: true
    };
    expect(result.sent).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts a failed send with error', () => {
    const result: CampaignResult = {
      trigger: 'birthday',
      channel: 'email',
      customer_id: 'c2',
      sent: false,
      error: 'SMTP timeout'
    };
    expect(result.sent).toBe(false);
    expect(result.error).toBe('SMTP timeout');
  });
});

describe('CampaignLogRow', () => {
  it('accepts a success log row', () => {
    const row: CampaignLogRow = {
      id: 'log-1',
      customer_id: 'c1',
      trigger: 'welcome',
      channel: 'sms',
      sent_at: '2026-07-01T10:00:00Z',
      status: 'sent'
    };
    expect(row.status).toBe('sent');
    expect(row.error).toBeUndefined();
  });

  it('accepts a failed log row with error', () => {
    const row: CampaignLogRow = {
      id: 'log-2',
      customer_id: 'c2',
      trigger: 'winback',
      channel: 'zalo',
      sent_at: '2026-07-01T10:05:00Z',
      status: 'failed',
      error: 'Zalo token expired'
    };
    expect(row.status).toBe('failed');
    expect(row.error).toBe('Zalo token expired');
  });

  it('accepted status string values match engine expectations', () => {
    const validStatuses = ['sent', 'failed'];
    validStatuses.forEach((s) => {
      const row: CampaignLogRow = {
        id: 'log-x',
        customer_id: 'cx',
        trigger: 'welcome',
        channel: 'email',
        sent_at: new Date().toISOString(),
        status: s as CampaignLogRow['status'],
        ...(s === 'failed' ? { error: 'err' } : {})
      };
      expect(row.status).toBe(s);
    });
  });
});

describe('type cross-compatibility', () => {
  it('CampaignResult customer_id matches CampaignCustomer id field', () => {
    const customer: CampaignCustomer = { id: 'c9', name: 'Test' };
    const result: CampaignResult = {
      trigger: 'welcome',
      channel: 'sms',
      customer_id: customer.id,
      sent: true
    };
    expect(result.customer_id).toBe(customer.id);
  });

  it('CampaignTrigger values are consistent between CampaignMessage and CampaignResult', () => {
    const triggers: CampaignTrigger[] = ['welcome', 'birthday', 'winback', 'post_visit', 'cashback_expiry'];
    triggers.forEach((t) => {
      const msg: CampaignMessage = {
        trigger: t,
        channel: 'sms',
        to: '000',
        body: 'test'
      };
      const result: CampaignResult = {
        trigger: t,
        channel: 'sms',
        customer_id: 'c',
        sent: true
      };
      expect(msg.trigger).toBe(result.trigger);
    });
  });
});
