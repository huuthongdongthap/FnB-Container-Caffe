import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { PageHeader, FooterSocialLinks, FooterLegalLinks, PageFooter } from '../StitchLayout';

describe('PageHeader', () => {
  it('renders default brand name', () => {
    renderWithProviders(<PageHeader />);
    expect(screen.getByText('AURA CAFE')).toBeTruthy();
  });

  it('renders custom brand name', () => {
    renderWithProviders(<PageHeader brand="MY SHOP" />);
    expect(screen.getByText('MY SHOP')).toBeTruthy();
  });

  it('renders rightContent when provided', () => {
    renderWithProviders(<PageHeader rightContent={<button>Cart</button>} />);
    expect(screen.getByText('Cart')).toBeTruthy();
  });

  it('applies sticky class when sticky prop is true', () => {
    const { container } = renderWithProviders(<PageHeader sticky />);
    const header = container.querySelector('header');
    expect(header?.className).toContain('sticky');
  });

  it('applies fixed class when sticky prop is false', () => {
    const { container } = renderWithProviders(<PageHeader sticky={false} />);
    const header = container.querySelector('header');
    expect(header?.className).toContain('fixed');
  });
});

describe('FooterSocialLinks', () => {
  it('renders social links', () => {
    const links = [{ label: 'FB' }, { label: 'IG' }];
    renderWithProviders(<FooterSocialLinks links={links} />);
    expect(screen.getByText('FB')).toBeTruthy();
    expect(screen.getByText('IG')).toBeTruthy();
  });

  it('renders empty when no links', () => {
    const { container } = renderWithProviders(<FooterSocialLinks links={[]} />);
    const linksDiv = container.querySelector('.flex.gap-6');
    expect(linksDiv?.children.length).toBe(0);
  });
});

describe('FooterLegalLinks', () => {
  it('renders legal links', () => {
    renderWithProviders(<FooterLegalLinks links={['Privacy', 'Terms']} />);
    expect(screen.getByText('Privacy')).toBeTruthy();
    expect(screen.getByText('Terms')).toBeTruthy();
  });
});

describe('PageFooter', () => {
  it('renders default brand', () => {
    renderWithProviders(<PageFooter />);
    expect(screen.getByText('AURA CAFE')).toBeTruthy();
  });

  it('renders copyLine', () => {
    renderWithProviders(<PageFooter copyLine="2024 AURA CAFE" />);
    expect(screen.getByText('2024 AURA CAFE')).toBeTruthy();
  });

  it('renders social links when provided', () => {
    renderWithProviders(
      <PageFooter socialLinks={[{ label: 'FB' }, { label: 'IG' }]} />,
    );
    expect(screen.getByText('FB')).toBeTruthy();
    expect(screen.getByText('IG')).toBeTruthy();
  });

  it('renders custom rows when provided', () => {
    renderWithProviders(<PageFooter rows={<div>Custom Row</div>} />);
    expect(screen.getByText('Custom Row')).toBeTruthy();
  });

  it('renders openStatus when provided', () => {
    renderWithProviders(<PageFooter openStatus={<span>Open 8am-10pm</span>} />);
    expect(screen.getByText('Open 8am-10pm')).toBeTruthy();
  });
});
