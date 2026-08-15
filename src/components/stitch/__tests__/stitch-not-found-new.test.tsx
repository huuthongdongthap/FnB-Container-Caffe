import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchNotFoundNew } from '../StitchNotFoundNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
  }),
}));

vi.mock('@/components/seo/HelmetHead', () => ({
  HelmetHead: () => null,
}));

vi.mock('lucide-react', () => ({
  Search: () => null,
  HelpCircle: () => null,
  Home: () => null,
}));

describe('stitch-not-found-new', () => {
  it('renders 404 heading', () => {
    renderWithProviders(<StitchNotFoundNew />);
    expect(screen.getByText('404')).toBeTruthy();
  });

  it('renders AURA CAFE brand in header', () => {
    renderWithProviders(<StitchNotFoundNew />);
    expect(screen.getByText('AURA CAFE')).toBeTruthy();
  });

  it('calls onSearch when search button clicked', () => {
    const onSearch = vi.fn();
    renderWithProviders(<StitchNotFoundNew onSearch={onSearch} />);
    const btn = screen.getByRole('button', { name: /search/i });
    fireEvent.click(btn);
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('calls onHelp when help button clicked', () => {
    const onHelp = vi.fn();
    renderWithProviders(<StitchNotFoundNew onHelp={onHelp} />);
    const btn = screen.getByRole('button', { name: /help/i });
    fireEvent.click(btn);
    expect(onHelp).toHaveBeenCalledTimes(1);
  });

  it('calls onNavigate with footer link paths', () => {
    const onNavigate = vi.fn();
    renderWithProviders(<StitchNotFoundNew onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText('Privacy'));
    expect(onNavigate).toHaveBeenCalledWith('/privacy');
    fireEvent.click(screen.getByText('Terms'));
    expect(onNavigate).toHaveBeenCalledWith('/terms');
    fireEvent.click(screen.getByText('Contact'));
    expect(onNavigate).toHaveBeenCalledWith('/contact');
  });

  it('calls onNavigate to /menu when menu button clicked', () => {
    const onNavigate = vi.fn();
    renderWithProviders(<StitchNotFoundNew onNavigate={onNavigate} />);
    const menuBtn = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(menuBtn);
    expect(onNavigate).toHaveBeenCalledWith('/menu');
  });
});
