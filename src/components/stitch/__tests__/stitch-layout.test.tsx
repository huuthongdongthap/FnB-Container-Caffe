import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

import {
  PageHeader,
  FooterSocialLinks,
  FooterLegalLinks,
  PageFooter,
} from '../StitchLayout';

describe('PageHeader', () => {
  it('renders default brand text', () => {
    renderWithProviders(<PageHeader />);
    expect(screen.getByText('AURA CAFE')).toBeInTheDocument();
  });

  it('renders custom brand', () => {
    renderWithProviders(<PageHeader brand="MY SHOP" />);
    expect(screen.getByText('MY SHOP')).toBeInTheDocument();
  });

  it('renders rightContent when provided', () => {
    renderWithProviders(<PageHeader rightContent={<button>Click</button>} />);
    expect(screen.getByRole('button', { name: 'Click' })).toBeInTheDocument();
  });
});

describe('FooterSocialLinks', () => {
  const links = [{ label: 'FB' }, { label: 'IG' }];

  it('renders all links', () => {
    renderWithProviders(<FooterSocialLinks links={links} />);
    expect(screen.getByText('FB')).toBeInTheDocument();
    expect(screen.getByText('IG')).toBeInTheDocument();
  });

  it('uses href when provided', () => {
    const withHref = [{ label: 'FB', href: 'https://fb.com' }];
    renderWithProviders(<FooterSocialLinks links={withHref} />);
    expect(screen.getByText('FB').closest('a')).toHaveAttribute('href', 'https://fb.com');
  });
});

describe('FooterLegalLinks', () => {
  it('renders all legal items', () => {
    renderWithProviders(<FooterLegalLinks links={['Privacy', 'Terms']} />);
    expect(screen.getByText('Privacy')).toBeInTheDocument();
    expect(screen.getByText('Terms')).toBeInTheDocument();
  });
});

describe('PageFooter', () => {
  it('renders default brand', () => {
    renderWithProviders(<PageFooter />);
    expect(screen.getByText('AURA CAFE')).toBeInTheDocument();
  });

  it('renders social links when provided', () => {
    renderWithProviders(
      <PageFooter socialLinks={[{ label: 'FB' }]} />,
    );
    expect(screen.getByText('FB')).toBeInTheDocument();
  });

  it('renders copyLine when provided', () => {
    renderWithProviders(<PageFooter copyLine="2024 Aura" />);
    expect(screen.getByText('2024 Aura')).toBeInTheDocument();
  });

  it('renders custom rows instead of defaults', () => {
    renderWithProviders(<PageFooter rows={<div>Custom row</div>} />);
    expect(screen.getByText('Custom row')).toBeInTheDocument();
    expect(screen.queryByText('AURA CAFE')).not.toBeInTheDocument();
  });
});
