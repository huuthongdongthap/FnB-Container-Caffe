import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchLandingNew } from '../StitchLandingNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, fallback?: string) => fallback ?? key ?? '',
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

describe('StitchLandingNew', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the AURA CAFE brand name in nav', () => {
    renderWithProviders(<StitchLandingNew />);
    const brandElements = screen.getAllByText('AURA CAFE');
    expect(brandElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders hero section with title and CTA buttons', () => {
    renderWithProviders(<StitchLandingNew />);
    expect(screen.getAllByText('AURA CAFE').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Khám phá ngay')).toBeTruthy();
    expect(screen.getByText('Thực đơn')).toBeTruthy();
  });

  it('renders feature cards (Menu, Reserve, Delivery)', () => {
    renderWithProviders(<StitchLandingNew />);
    expect(screen.getByText('Menu đa dạng')).toBeTruthy();
    expect(screen.getByText('Đặt bàn nhanh')).toBeTruthy();
    expect(screen.getByText('Giao tận nơi')).toBeTruthy();
  });

  it('renders gallery section', () => {
    renderWithProviders(<StitchLandingNew />);
    expect(screen.getByText('Kiến Trúc Độc Bản')).toBeTruthy();
  });

  it('renders location section with address', () => {
    renderWithProviders(<StitchLandingNew />);
    expect(screen.getByText(/Ghé thăm chúng tôi tại Sa Đéc/)).toBeTruthy();
    expect(screen.getByText('Mở cửa: 07:00 - 23:00 mỗi ngày')).toBeTruthy();
  });

  it('renders footer with contact and privacy links', () => {
    renderWithProviders(<StitchLandingNew />);
    expect(screen.getByText('Contact Us')).toBeTruthy();
    expect(screen.getByText('Privacy Policy')).toBeTruthy();
  });

  it('has glass panel elements for parallax', () => {
    const { container } = renderWithProviders(<StitchLandingNew />);
    const glassPanels = container.querySelectorAll('[data-glass-panel]');
    expect(glassPanels.length).toBeGreaterThanOrEqual(3);
  });
});
