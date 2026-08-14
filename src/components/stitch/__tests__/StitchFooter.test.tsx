import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import StitchFooter from '../StitchFooter';

describe('StitchFooter', () => {
  it('renders the brand name', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText('AURA CAFE')).toBeTruthy();
  });

  it('renders service links', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText('Menu')).toBeTruthy();
    expect(screen.getByText('Reservations')).toBeTruthy();
  });

  it('renders contact info section', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText(/39 Nguyễn Tất Thành/i)).toBeTruthy();
  });

  it('renders opening hours section', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText(/Opening Hours/i)).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = renderWithProviders(<StitchFooter className="custom-footer" />);
    expect(container.querySelector('.custom-footer')).toBeTruthy();
  });

  it('renders social media links', () => {
    const { container } = renderWithProviders(<StitchFooter />);
    const footer = container.querySelector('footer');
    expect(footer).toBeTruthy();
  });
});
