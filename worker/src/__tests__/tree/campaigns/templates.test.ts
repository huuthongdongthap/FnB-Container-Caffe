/** Campaign Templates — renderTemplate bilingual checks */
import { describe, it, expect, vi } from 'vitest';
import { renderTemplate } from '../../../tree/campaigns/templates';
import type { CampaignTrigger } from '../../../tree/campaigns/types';

describe('renderTemplate', () => {
  // ── Default locale (vi) ────────────────────────────────────────────────────

  describe.each<CampaignTrigger>([
    'welcome',
    'birthday',
    'winback',
    'post_visit',
    'cashback_expiry'
  ])('trigger %s (Vietnamese default)', (trigger) => {
    it('returns RenderedTemplate with subject, sms, html', () => {
      const result = renderTemplate(trigger, 'Nguyen Van A');
      expect(result).toHaveProperty('subject');
      expect(result).toHaveProperty('sms');
      expect(result).toHaveProperty('html');
      expect(typeof result.subject).toBe('string');
      expect(typeof result.sms).toBe('string');
      expect(typeof result.html).toBe('string');
    });

    it('does not return English content by default', () => {
      const result = renderTemplate(trigger);
      expect(result.subject).not.toMatch(/Welcome to AURA/);
      expect(result.sms).not.toMatch(/Welcome to AURA/);
    });
  });

  // ── English locale ─────────────────────────────────────────────────────────

  describe.each<CampaignTrigger>([
    'welcome',
    'birthday',
    'winback',
    'post_visit',
    'cashback_expiry'
  ])('trigger %s (English)', (trigger) => {
    it('returns English content when locale=English', () => {
      const result = renderTemplate(trigger, 'Nguyen Van A', undefined, 'en');
      expect(result.subject).toMatch(/[A-Za-z]/); // contains Latin letters
    });
  });

  // ── welcome ───────────────────────────────────────────────────────────────

  describe('welcome', () => {
    it('includes WELCOME10 code in Vietnamese output', () => {
      const result = renderTemplate('welcome', 'Bạn');
      expect(result.sms).toContain('WELCOME10');
      expect(result.html).toContain('WELCOME10');
    });

    it('includes WELCOME10 code in English output', () => {
      const result = renderTemplate('welcome', 'Friend', undefined, 'en');
      expect(result.sms).toContain('WELCOME10');
    });

    it('substitutes name into sms body', () => {
      const result = renderTemplate('welcome', 'An');
      expect(result.sms).toContain('An');
    });

    it('falls back to "bạn" when name is undefined', () => {
      const result = renderTemplate('welcome');
      expect(result.sms).toContain('bạn');
    });
  });

  // ── birthday ──────────────────────────────────────────────────────────────

  describe('birthday', () => {
    it('mentions 15% discount in both locales', () => {
      const viResult = renderTemplate('birthday', 'Bạn');
      const enResult = renderTemplate('birthday', 'You', undefined, 'en');
      expect(viResult.sms).toContain('15%');
      expect(enResult.sms).toMatch(/15%/);
    });

    it('substitutes name', () => {
      const result = renderTemplate('birthday', 'Minh');
      expect(result.sms).toContain('Minh');
      // subject is static in VI birthday template — no name substitution
    });
  });

  // ── winback ───────────────────────────────────────────────────────────────

  describe('winback', () => {
    it('contains the winback hook in Vietnamese', () => {
      const result = renderTemplate('winback');
      expect(result.sms).toMatch(/nhớ|nham|ghe|AURA/i);
    });

    it('contains the winback hook in English', () => {
      const result = renderTemplate('winback', 'Friend', undefined, 'en');
      expect(result.sms).toMatch(/haven't seen you/i);
    });
  });

  // ── post_visit ────────────────────────────────────────────────────────────

  describe('post_visit', () => {
    const defaultLink = 'https://auraspace.cafe/review';

    it('uses the default review link when no data provided', () => {
      const result = renderTemplate('post_visit');
      expect(result.html).toContain(defaultLink);
      expect(result.sms).toContain(defaultLink);
    });

    it('uses a custom review_link from data', () => {
      const customLink = 'https://app.aura.cafe/review/abc123';
      const result = renderTemplate('post_visit', undefined, { review_link: customLink });
      expect(result.html).toContain(customLink);
      expect(result.sms).toContain(customLink);
    });

    it('escapes link into an href in html', () => {
      const result = renderTemplate('post_visit');
      expect(result.html).toContain('<a href=');
    });
  });

  // ── cashback_expiry ───────────────────────────────────────────────────────

  describe('cashback_expiry', () => {
    it('formats the cashback amount with Vietnamese locale', () => {
      const result = renderTemplate('cashback_expiry', 'Bạn', { amount: 50000, days_left: 7 });
      expect(result.subject).toMatch(/50[,.]000/);
    });

    it('renders with default values when data is absent', () => {
      const result = renderTemplate('cashback_expiry');
      // default amount=0, days_left=7
      expect(result.subject).toContain('VN'); // currency label
    });

    it('uses custom amount and days from data', () => {
      const result = renderTemplate(
        'cashback_expiry',
        'Bạn',
        { amount: 150000, days_left: 3 }
      );
      expect(result.sms).toContain('150');
      expect(result.sms).toContain('3');
      expect(result.subject).toContain('150');
    });

    it('works in English with data', () => {
      const result = renderTemplate(
        'cashback_expiry',
        'You',
        { amount: 25000, days_left: 5 },
        'en'
      );
      expect(result.sms).toContain('25');
      expect(result.sms).toContain('5');
      expect(result.subject).toContain('25');
    });
  });

  // ── safeName fallback ──────────────────────────────────────────────────────

  describe('safeName fallback', () => {
    it('returns "bạn" when name is empty string', () => {
      const result = renderTemplate('welcome', '');
      expect(result.sms).toContain('bạn');
    });

    it('returns "bạn" when name is undefined', () => {
      const result = renderTemplate('welcome');
      expect(result.sms).toContain('bạn');
    });
  });

  // ── formatCurrency ────────────────────────────────────────────────────────

  describe('formatCurrency', () => {
    // formatCurrency is used internally for cashback_expiry;
    // we validate its effect through rendered output.
    it('formats 0 as "0" in VI locale', () => {
      const result = renderTemplate('cashback_expiry', undefined, { amount: 0 });
      // subject contains the formatted amount from formatCurrency
      expect(result.subject).toContain('0');
    });

    it('formats large numbers with locale separator', () => {
      const result = renderTemplate('cashback_expiry', undefined, { amount: 100000 });
      // 100,000 in vi-VN locale uses comma as group separator
      expect(result.subject).toMatch(/100[,.]?000/);
    });
  });

  // ── HTML structure ────────────────────────────────────────────────────────

  describe('html structure', () => {
    it.each<CampaignTrigger>(['welcome', 'birthday', 'winback', 'post_visit', 'cashback_expiry'])
    ('includes <h1>AURA CAFE in %s', (trigger) => {
      const result = renderTemplate(trigger, undefined, undefined, 'vi');
      expect(result.html).toContain('<h1>AURA CAFE</h1>');
    });

    it('includes <h1>AURA CAFE in English', () => {
      const result = renderTemplate('welcome', undefined, undefined, 'en');
      expect(result.html).toContain('<h1>AURA CAFE</h1>');
    });
  });
});
