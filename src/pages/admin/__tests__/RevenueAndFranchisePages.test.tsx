import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test-utils';
import RevenueAccountingPage from '../RevenueAccounting';
import FranchiseReportsPage from '../FranchiseReports';

const mockApiFetch = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

describe('Admin Revenue Accounting (P&L) & Franchise Royalty Pages', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it('renders P&L net revenue, BOM COGS, gross profit, and daily row', async () => {
    mockApiFetch.mockResolvedValueOnce({
      success: true,
      data: {
        from: '2026-11-01',
        to: '2026-11-18',
        timezone: 'Asia/Ho_Chi_Minh',
        totals: {
          orders: 42,
          gross_sales: 4500000,
          discounts: 300000,
          net_revenue: 4200000,
          refunds: 0,
          cogs: 1260000,
          waste_cost: 40000,
          gross_profit: 2900000,
          gross_margin_pct: 69.0,
        },
        daily: [
          {
            date: '2026-11-18',
            orders: 42,
            gross_sales: 4500000,
            discounts: 300000,
            net_revenue: 4200000,
            refunds: 0,
            cogs: 1260000,
            waste_cost: 40000,
            gross_profit: 2900000,
            gross_margin_pct: 69.0,
          },
        ],
      },
    });

    renderWithProviders(<RevenueAccountingPage />);

    expect(screen.getByText(/Báo cáo Lãi Lỗ & Giá vốn BOM/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('2026-11-18')).toBeInTheDocument();
      expect(screen.getAllByText('69.0%').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders Franchise locations and Royalty fee settlement table', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            id: 'loc_sadec_01',
            code: 'SADEC-01',
            name: 'Aura Container Sa Đéc Hùng Vương',
            tenant_id: 'default',
            royalty_percentage: 5,
            status: 'active',
          },
        ],
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          location_id: 'loc_sadec_01',
          code: 'SADEC-01',
          name: 'Aura Container Sa Đéc Hùng Vương',
          tenant_id: 'default',
          order_count: 128,
          gross_sales: 12000000,
          royalty_percentage: 5,
          royalty_amount: 600000,
          net_franchisee_payout: 11400000,
        },
      });

    renderWithProviders(<FranchiseReportsPage />);

    expect(screen.getByText(/Đối soát Nhượng quyền & Phí Bản quyền/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('SADEC-01')).toBeInTheDocument();
      expect(screen.getByText('Aura Container Sa Đéc Hùng Vương')).toBeInTheDocument();
      expect(screen.getByText('5%')).toBeInTheDocument();
    });
  });
});
