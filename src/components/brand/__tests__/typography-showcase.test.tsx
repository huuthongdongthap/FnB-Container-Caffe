import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { TypographyShowcase } from '../TypographyShowcase';

describe('TypographyShowcase', () => {
  const fonts = [
    { name: 'Cormorant Garamond', category: 'Display', usage: 'Tiêu đề H1/H2' },
    { name: 'Space Grotesk', category: 'Body', usage: 'Thân văn bản' },
    { name: 'Plus Jakarta Sans', category: 'Utility', usage: 'Button, label' },
  ];

  it('renders all font specimens with names', () => {
    render(<TypographyShowcase fonts={fonts} />);
    expect(screen.getByText('Cormorant Garamond')).toBeInTheDocument();
    expect(screen.getByText('Space Grotesk')).toBeInTheDocument();
    expect(screen.getByText('Plus Jakarta Sans')).toBeInTheDocument();
  });

  it('shows font category labels', () => {
    render(<TypographyShowcase fonts={fonts} />);
    expect(screen.getByText('Display')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Utility')).toBeInTheDocument();
  });

  it('shows usage descriptions', () => {
    render(<TypographyShowcase fonts={fonts} />);
    expect(screen.getByText('Tiêu đề H1/H2')).toBeInTheDocument();
    expect(screen.getByText('Thân văn bản')).toBeInTheDocument();
  });

  it('renders sample text for each font', () => {
    render(<TypographyShowcase fonts={fonts} />);
    const samples = screen.getAllByText(/AURA CAFE|Cà phê|Button/i);
    expect(samples.length).toBeGreaterThanOrEqual(3);
  });
});
