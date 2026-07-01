import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils';
import { ColorPalette } from '../ColorPalette';

const mockWriteText = vi.fn();
Object.assign(navigator, {
  clipboard: { writeText: mockWriteText },
});

describe('ColorPalette', () => {
  const sampleColors = [
    { name: 'Noir Void', token: '--aura-noir-void', hex: '#050D1A' },
    { name: 'Chrome Master', token: '--aura-chrome-master', hex: '#C9D6DF' },
    { name: 'Forest Deep', token: '--aura-forest-deep', hex: '#1A2D1F' },
  ];

  it('renders all brand colors with hex labels', () => {
    render(<ColorPalette colors={sampleColors} />);
    expect(screen.getByText('Noir Void')).toBeInTheDocument();
    expect(screen.getByText('Chrome Master')).toBeInTheDocument();
    expect(screen.getByText('Forest Deep')).toBeInTheDocument();

    expect(screen.getByText('#050D1A')).toBeInTheDocument();
    expect(screen.getByText('#C9D6DF')).toBeInTheDocument();
    expect(screen.getByText('#1A2D1F')).toBeInTheDocument();
  });

  it('shows token variable names', () => {
    render(<ColorPalette colors={sampleColors} />);
    expect(screen.getByText('--aura-noir-void')).toBeInTheDocument();
    expect(screen.getByText('--aura-chrome-master')).toBeInTheDocument();
  });

  it('copies hex value to clipboard on click', () => {
    render(<ColorPalette colors={sampleColors} />);
    fireEvent.click(screen.getByText('#C9D6DF'));
    expect(mockWriteText).toHaveBeenCalledWith('#C9D6DF');
  });

  it('groups colors by category when category prop provided', () => {
    const colorsWithCategories = sampleColors.map((c) => ({
      ...c,
      category: c.name.includes('Noir') ? 'Surfaces' : 'Accents',
    }));
    render(<ColorPalette colors={colorsWithCategories} categories />);
    expect(screen.getByText('Surfaces')).toBeInTheDocument();
    expect(screen.getByText('Accents')).toBeInTheDocument();
  });
});
