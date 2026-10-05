import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '@/test-utils';
import InventoryPage from '../Inventory';
import * as apiClient from '@/lib/api-client';

vi.mock('@/components/seo/HelmetHead', () => ({
  HelmetHead: () => null,
}));

describe('InventoryPage', () => {
  const mockIngredients = [
    { id: 'ing_1', sku: 'CF-ROB-01', name: 'Cà phê Robusta', category: 'raw_materials', unit: 'kg', cost_per_unit: 120000, current_stock: 45, min_stock: 10, max_stock: 100, is_active: 1 },
    { id: 'ing_2', sku: 'MILK-01', name: 'Sữa tươi Dalat Milk', category: 'dairy', unit: 'lít', cost_per_unit: 32000, current_stock: 4, min_stock: 15, max_stock: 50, is_active: 1 },
    { id: 'ing_3', sku: 'CUP-01', name: 'Ly takeaway', category: 'packaging', unit: 'pcs', cost_per_unit: 800, current_stock: 0, min_stock: 200, max_stock: 2000, is_active: 1 },
  ];
  const mockMovements = [
    { id: 'mov_1', ingredient_id: 'ing_1', ingredient_name: 'Cà phê Robusta', type: 'in' as const, quantity: 50, notes: 'Nhập đầu tuần', created_by: 'Admin', created_at: '2026-10-04T08:00:00.000Z' },
  ];
  const mockSuppliers = [
    { id: 'sup_1', name: 'Viva Star Coffee', contact_person: 'Nguyễn Văn A', phone: '0901234567', email: 'viva@test.com', is_active: 1 },
  ];
  const mockPurchaseOrders = [
    { id: 'po_1', po_number: 'PO-001', supplier_name: 'Viva Star Coffee', order_date: '2026-10-01', status: 'received' as const, total: 12500000 },
  ];
  const mockForecast = [
    { id: 'f_1', sku: 'MILK-01', name: 'Sữa tươi Dalat Milk', current_stock: 4, daily_run_rate: 3.5, days_of_supply: 1.1, risk_level: 'CRITICAL' as const, recommended_reorder_qty: 30, unit: 'lít' },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, 'apiFetch').mockImplementation((url: string) => {
      if (url.includes('/api/inventory/ingredients')) return Promise.resolve({ success: true, data: mockIngredients });
      if (url.includes('/api/inventory/movements')) return Promise.resolve({ success: true, data: mockMovements });
      if (url.includes('/api/inventory/suppliers')) return Promise.resolve({ success: true, data: mockSuppliers });
      if (url.includes('/api/inventory/purchase-orders')) return Promise.resolve({ success: true, data: mockPurchaseOrders });
      if (url.includes('/api/inventory/forecasting/run-rate')) return Promise.resolve({ success: true, data: mockForecast });
      return Promise.resolve({ success: true, data: [] });
    });
  });

  it('renders header, KPI stats cards, and ingredients table', async () => {
    renderWithProviders(<InventoryPage />);
    expect(screen.getByText('Quản lý kho hàng & Nguyên vật liệu')).toBeInTheDocument();
    expect(screen.getByText('Tổng mặt hàng')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Cà phê Robusta')).toBeInTheDocument();
      expect(screen.getByText('Sữa tươi Dalat Milk')).toBeInTheDocument();
      expect(screen.getByText('Ly takeaway')).toBeInTheDocument();
    });
    expect(screen.getByText('Đủ hàng')).toBeInTheDocument();
    expect(screen.getByText('Sắp hết')).toBeInTheDocument();
    expect(screen.getByText('Hết hàng')).toBeInTheDocument();
  });

  it('filters ingredients by search keyword', async () => {
    renderWithProviders(<InventoryPage />);
    await waitFor(() => {
      expect(screen.getByText('Cà phê Robusta')).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText('Tìm theo tên nguyên liệu, mã SKU...');
    fireEvent.change(searchInput, { target: { value: 'Robusta' } });
    expect(screen.getByText('Cà phê Robusta')).toBeInTheDocument();
    expect(screen.queryByText('Sữa tươi Dalat Milk')).not.toBeInTheDocument();
  });

  it('navigates to movements, suppliers, and forecasting tabs', async () => {
    renderWithProviders(<InventoryPage />);
    fireEvent.click(screen.getByText('Lịch sử biến động'));
    await waitFor(() => {
      expect(screen.getByText('Nhập đầu tuần')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nhà cung cấp & Đơn mua'));
    await waitFor(() => {
      expect(screen.getAllByText('Viva Star Coffee').length).toBeGreaterThan(0);
      expect(screen.getByText('PO-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Dự báo tiêu hao AI'));
    await waitFor(() => {
      expect(screen.getByText(/Dự báo tiêu hao tự động bằng Trí tuệ nhân tạo/i)).toBeInTheDocument();
      expect(screen.getByText('1.1 ngày')).toBeInTheDocument();
    });
  });

  it('opens and closes movement modal when clicking Điều chỉnh', async () => {
    renderWithProviders(<InventoryPage />);
    let adjustButtons: HTMLElement[] = [];
    await waitFor(() => {
      adjustButtons = screen.getAllByText('Điều chỉnh');
      expect(adjustButtons.length).toBeGreaterThan(0);
    });
    const firstAdjustBtn = adjustButtons[0];
    if (firstAdjustBtn) fireEvent.click(firstAdjustBtn);
    expect(screen.getByText(/Biến động kho: Cà phê Robusta/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Hủy'));
    await waitFor(() => {
      expect(screen.queryByText(/Biến động kho: Cà phê Robusta/i)).not.toBeInTheDocument();
    });
  });
});
