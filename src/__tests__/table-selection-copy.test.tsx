import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MenuTableBanner } from '@/components/menu/menu-catalog-unavailable-state';
import { TableOrder } from '@/pages/TableOrder';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key,
  }),
}));

vi.mock('@/components/seo/HelmetHead', () => ({
  HelmetHead: () => null,
}));

vi.mock('@/components/stitch', () => ({
  StitchMobileOrderNew: () => <div data-testid="mock-mobile-order" />,
}));

vi.mock('@/components/stitch/StitchLandingNew-nav', () => ({
  LandingNav: () => <nav data-testid="mock-landing-nav" />,
}));

vi.mock('@/components/stitch/StitchLandingNew-footer', () => ({
  LandingFooter: () => <footer data-testid="mock-landing-footer" />,
}));

vi.mock('@/hooks/stores/use-order-store', () => ({
  useOrderStoreWithOfflineFlush: () => false,
}));

describe('New-order table selection copy (issue #95)', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('MenuTableBanner clarifies choosing a table for a new order instead of transferring', () => {
    render(<MenuTableBanner tableNumber="05" />);

    const link = screen.getByRole('link', { name: 'Chọn bàn cho đơn mới' });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/order');
    expect(link.getAttribute('title')).toContain('Đơn hiện có vẫn ở bàn ban đầu');
    expect(screen.queryByText('Đổi bàn')).toBeNull();
  });

  it('TableOrder POS header clarifies choosing a table for a new order instead of transferring', () => {
    render(
      <MemoryRouter initialEntries={['/pos/table/05']}>
        <Routes>
          <Route path="/pos/table/:tableId" element={<TableOrder />} />
        </Routes>
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: 'Chọn bàn cho đơn mới' });
    expect(button).toBeTruthy();
    expect(button.getAttribute('title')).toContain('Đơn hiện có vẫn giữ nguyên ở bàn ban đầu');
    expect(screen.queryByText('Đổi bàn')).toBeNull();

    fireEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith('/pos/table/select');
  });
});
