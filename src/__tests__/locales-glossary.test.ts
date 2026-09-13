import { describe, it, expect } from 'vitest';
import viJson from '../locales/vi.json';
import enJson from '../locales/en.json';

// Glossary (ratified 2026-09-13): referral = "Giới thiệu bạn bè".
// These assertions lock locale values to the glossary so drift fails CI
// instead of silently shipping ambiguous copy.

const vi = viJson as unknown as Record<string, Record<string, unknown>>;
const en = enJson as unknown as Record<string, Record<string, unknown>>;

type Section = Record<string, Record<string, unknown>>;
type Sub = Record<string, Record<string, unknown>>;

describe('locale glossary compliance', () => {
  it('both locale files parse as valid JSON objects', () => {
    expect(vi).toBeTypeOf('object');
    expect(en).toBeTypeOf('object');
  });

  it('vi referral labels use the ratified glossary term', () => {
    const nav = vi.nav as Section;
    const footer = vi.footer as Section;
    expect(nav.referral).toBe('Giới thiệu bạn bè');
    expect(footer.referral).toBe('Giới thiệu bạn bè');
  });

  it('vi referral term matches the loyalty page term (no ambiguous variant)', () => {
    const loyalty = vi.loyalty as Section;
    expect(loyalty.referEarn).toBe('Giới thiệu bạn bè');
  });

  it('vi has stitch.accountDashboard.errorDescription translated (no en fallback)', () => {
    const viStitch = vi.stitch as Sub;
    const enStitch = en.stitch as Sub;
    const viDash = viStitch.accountDashboard as Record<string, unknown>;
    const enDash = enStitch.accountDashboard as Record<string, unknown>;
    const value = viDash.errorDescription;
    expect(value).toBeTruthy();
    expect(value).not.toBe(enDash.errorDescription);
  });
});
