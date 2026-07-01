import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { HeroSection } from '@/components/home/hero-section';

describe('HeroSection', () => {
  it('renders headline text', () => {
    render(<HeroSection />);
    expect(screen.getByText('AURA')).toBeInTheDocument();
    expect(screen.getByText('CAFÉ')).toBeInTheDocument();
  });

  it('renders tagline', () => {
    render(<HeroSection />);
    expect(screen.getByText(/industrial-luxury/)).toBeInTheDocument();
  });

  it('renders CTA buttons', () => {
    render(<HeroSection />);
    expect(screen.getByRole('button', { name: /đặt bàn/i })).toBeInTheDocument();
    expect(screen.getByText('Khám Phá Menu')).toBeInTheDocument();
  });

  it('renders feature pills', () => {
    render(<HeroSection />);
    expect(screen.getByText('Hoàng Hôn Lộng Gió')).toBeInTheDocument();
    expect(screen.getByText('Specialty Coffee')).toBeInTheDocument();
    expect(screen.getByText('Industrial Lounge')).toBeInTheDocument();
  });

  it('renders water ripple canvas element', () => {
    const { container } = render(<HeroSection />);
    const canvas = container.querySelector('#water-ripple-canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('has links to menu and table reservation', () => {
    render(<HeroSection />);
    const menuLink = screen.getByText('Khám Phá Menu').closest('a');
    expect(menuLink).toHaveAttribute('href', '/menu');
  });
});
