import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils';
import { FiveZoneShowcase } from '@/components/home/five-zone-showcase';

describe('FiveZoneShowcase', () => {
  it('renders the section header', () => {
    render(<FiveZoneShowcase />);
    expect(screen.getByText('5 Không Gian Trải Nghiệm')).toBeInTheDocument();
  });

  it('renders all 5 zone tabs with correct subtitle labels', () => {
    render(<FiveZoneShowcase />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(5);
    // Tabs render z.subtitle, not z.name
    expect(tabs[0]).toHaveTextContent('Jade Counter');
    expect(tabs[1]).toHaveTextContent('Sky Deck');
    expect(tabs[2]).toHaveTextContent('Noir Cabin');
    expect(tabs[3]).toHaveTextContent('Aura Lounge');
    expect(tabs[4]).toHaveTextContent('Ban Công Treo');
  });

  it('shows Jade Counter details by default (first zone)', () => {
    render(<FiveZoneShowcase />);
    expect(screen.getByText('Walnut & Jade')).toBeInTheDocument();
  });

  it('switches zone content when tab clicked', () => {
    render(<FiveZoneShowcase />);
    fireEvent.click(screen.getByRole('tab', { name: /sky deck/i }));
    expect(screen.getByText('8m so với mặt phố')).toBeInTheDocument();
    expect(screen.queryByText('Walnut & Jade')).not.toBeInTheDocument();
  });

  it('renders all 5 tabs with proper ARIA roles', () => {
    render(<FiveZoneShowcase />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(5);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('each zone tab links to menu page via the CTA', () => {
    render(<FiveZoneShowcase />);
    const exploreLink = screen.getByText(/khám phá thêm về không gian/i);
    expect(exploreLink).toBeInTheDocument();
    const link = exploreLink.closest('a');
    expect(link).toHaveAttribute('href', '/about-us');
  });

  it('shows correct zone when switching between tabs', () => {
    render(<FiveZoneShowcase />);

    // Start with Jade Counter
    expect(screen.getByText('Mộc Mạc & Tự Nhiên')).toBeInTheDocument();

    // Switch to Noir Cabin
    fireEvent.click(screen.getByRole('tab', { name: /noir cabin/i }));
    expect(screen.getByText('Ấm Cúng & Công Nghiệp')).toBeInTheDocument();

    // Switch to Aura Lounge
    fireEvent.click(screen.getByRole('tab', { name: /aura lounge/i }));
    expect(screen.getByText('Tây Hướng Hoàng Hôn')).toBeInTheDocument();

    // Switch to VIP Steel Nest tab (subtitle = "Ban Công Treo")
    fireEvent.click(screen.getByRole('tab', { name: /ban công treo/i }));
    expect(screen.getByText('Yên Tĩnh & Độc Bản')).toBeInTheDocument();
  });
});
