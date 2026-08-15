import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test-utils';
import { StitchPromotionsNew } from '../StitchPromotionsNew';
import type { PromoOffer } from '../StitchPromotionsNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {};
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('lucide-react', () => ({
  Clock: () => null,
  ArrowRight: () => null,
  Lock: () => null,
  Zap: () => null,
}));

const MOCK_OFFERS: PromoOffer[] = [
  { id: 'o1', title: 'Golden Hour Ritual', description: '2-for-1 cold brews.', imageUrl: '/img1.jpg', imageAlt: 'Cold brew', badge: { label: 'Active' }, schedule: 'DAILY 8PM - 9PM' },
  { id: 'o2', title: 'Inner Circle Exclusive', description: '15% off pastries.', imageUrl: '/img2.jpg', imageAlt: 'Pastries', badge: { label: 'Exclusive', variant: 'glass' }, isLocked: true },
  { id: 'o3', title: 'Weekend Solace', description: 'Free vessel with bulk beans.', imageUrl: '/img3.jpg', imageAlt: 'Vessel', badge: { label: 'Limited' }, tags: ['CHROME SERIES'], cta: 'Details' },
];

describe('StitchPromotionsNew', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('renders hero promotion title', () => {
    renderWithProviders(<StitchPromotionsNew countdownSeconds={3600} offers={MOCK_OFFERS} />);
    expect(screen.getByText('The Nocturnal Reserve')).toBeTruthy();
  });

  it('renders offer titles', () => {
    renderWithProviders(<StitchPromotionsNew countdownSeconds={3600} offers={MOCK_OFFERS} />);
    expect(screen.getByText('Golden Hour Ritual')).toBeTruthy();
    expect(screen.getByText('Inner Circle Exclusive')).toBeTruthy();
    expect(screen.getByText('Weekend Solace')).toBeTruthy();
  });

  it('renders countdown timer', () => {
    renderWithProviders(<StitchPromotionsNew countdownSeconds={3661} offers={MOCK_OFFERS} />);
    expect(screen.getByText('01:01:01')).toBeTruthy();
  });

  it('counts down from initial value', () => {
    renderWithProviders(<StitchPromotionsNew countdownSeconds={65} offers={MOCK_OFFERS} />);
    // 65 seconds = 00:01:05
    expect(screen.getByText('00:01:05')).toBeTruthy();
  });

  it('renders offer badges', () => {
    renderWithProviders(<StitchPromotionsNew countdownSeconds={3600} offers={MOCK_OFFERS} />);
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Exclusive')).toBeTruthy();
  });

  it('renders schedule text', () => {
    renderWithProviders(<StitchPromotionsNew countdownSeconds={3600} offers={MOCK_OFFERS} />);
    expect(screen.getByText('DAILY 8PM - 9PM')).toBeTruthy();
  });

  it('renders Claim Offer button for hero', () => {
    renderWithProviders(<StitchPromotionsNew countdownSeconds={3600} offers={MOCK_OFFERS} />);
    expect(screen.getByText('Claim Offer')).toBeTruthy();
  });
});
