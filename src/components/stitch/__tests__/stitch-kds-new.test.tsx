import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';

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

vi.mock('@/hooks/use-focus-trap', () => ({
  useFocusTrap: vi.fn(),
}));

import { StitchKDSNew } from '../StitchKDSNew';

describe('StitchKDSNew', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders loading state skeleton cards', () => {
    renderWithProviders(<StitchKDSNew isLoading />);
    expect(screen.getAllByLabelText('Loading ticket').length).toBeGreaterThan(0);
  });

  it('renders error state with message', () => {
    renderWithProviders(<StitchKDSNew error="Station offline" />);
    expect(screen.getByText('Station offline')).toBeInTheDocument();
  });

  it('renders station label', () => {
    renderWithProviders(<StitchKDSNew />);
    expect(screen.getAllByText('STATION 01').length).toBeGreaterThanOrEqual(1);
  });

  it('renders station name', () => {
    renderWithProviders(<StitchKDSNew />);
    expect(screen.getByText('GRILL & SAUTE')).toBeInTheDocument();
  });

  it('renders status badge counts with i18n keys', () => {
    renderWithProviders(<StitchKDSNew />);
    expect(screen.getAllByLabelText(/kds\.preparing/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText(/kds\.pending/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText(/kds\.ready/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders overdue badge', () => {
    renderWithProviders(<StitchKDSNew />);
    expect(screen.getByLabelText(/kds\.overdue/)).toBeInTheDocument();
  });

  it('calls onCompleteTicket when complete button clicked', async () => {
    const onComplete = vi.fn();
    const user = (await import('@testing-library/user-event')).default.setup();
    renderWithProviders(<StitchKDSNew onCompleteTicket={onComplete} />);
    const completeBtns = screen.getAllByRole('button', { name: /complete/i });
    if (completeBtns.length > 0) {
      await user.click(completeBtns[0]);
      expect(onComplete).toHaveBeenCalled();
    }
  });
});
