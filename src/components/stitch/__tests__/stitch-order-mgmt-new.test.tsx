import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

import { StitchOrderMgmtNew } from '../StitchOrderMgmtNew';

describe('StitchOrderMgmtNew', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders loading state', () => {
    renderWithProviders(<StitchOrderMgmtNew isLoading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders error state with message', () => {
    renderWithProviders(<StitchOrderMgmtNew error="Connection failed" />);
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('renders stat card values', () => {
    renderWithProviders(<StitchOrderMgmtNew />);
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getAllByText('12').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('06')).toBeInTheDocument();
    expect(screen.getByText('8.5m')).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderWithProviders(<StitchOrderMgmtNew />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders filter tabs with i18n keys', () => {
    renderWithProviders(<StitchOrderMgmtNew />);
    expect(screen.getAllByText('orderMgmt.all').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('orderMgmt.pending').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('orderMgmt.served').length).toBeGreaterThanOrEqual(1);
  });

  it('renders order customer name', () => {
    renderWithProviders(<StitchOrderMgmtNew />);
    expect(screen.getByText('Julian Vane')).toBeInTheDocument();
  });

  it('calls onRefresh when retry button clicked in error state', async () => {
    const onRefresh = vi.fn();
    const user = (await import('@testing-library/user-event')).default.setup();
    renderWithProviders(
      <StitchOrderMgmtNew error="Something went wrong" onRefresh={onRefresh} />,
    );
    const retryBtn = screen.getByLabelText(/terminal\.retry/);
    await user.click(retryBtn);
    expect(onRefresh).toHaveBeenCalled();
  });
});
