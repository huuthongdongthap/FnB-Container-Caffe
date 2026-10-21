'use client';

import { useState, useMemo, useEffect } from 'react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useCartStore } from '@/hooks/stores/use-cart-store';
import { useKDS } from '@/hooks/use-kds';
import { useAdminOrdersStore } from '@/hooks/stores/admin/use-admin-orders-store';
import { useAdminCustomersStore } from '@/hooks/stores/admin/use-admin-customers-store';
import { buildSystemHubCategories } from './system-hub-catalog';
import {
  filterSystemHubCategories,
  countSystemHubSections,
} from './system-hub-queries';
import { SystemHubHeroTelemetry, SystemHubFooter } from './system-hub-sections';
import { DataSyncArchitectureStrip } from './system-hub-data-sync-strip';
import { SystemHubTopBar } from './system-hub-top-bar';
import { SystemHubSearchFilter } from './system-hub-search-filter';
import { SystemHubCategoryGrid } from './system-hub-category-grid';

/**
 * Composition root for the operations portal (`/hub`, `/portal`).
 *
 * All page-local state lives here; the catalogue data, the derive queries and
 * every presentational block live in the sibling `system-hub-*` modules.
 */
export default function SystemHubPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Real-time data hooks connected with main storefront & operations
  const cartItems = useCartStore((s) => s.items);
  const cartSubtotal = useCartStore((s) => s.subtotal());
  const { orders: kdsOrders } = useKDS('all');
  const { orders: adminOrders, fetchOrders } = useAdminOrdersStore();
  const { customers, fetchCustomers } = useAdminCustomersStore();

  useEffect(() => {
    const hasAuthToken =
      typeof window !== 'undefined' &&
      Boolean(
        window.localStorage.getItem('aura_auth_token') ||
          window.localStorage.getItem('auth_token') ||
          window.localStorage.getItem('aura_access_token'),
      );
    if (!hasAuthToken) return;
    fetchOrders().catch(() => {});
    fetchCustomers(1).catch(() => {});
  }, [fetchOrders, fetchCustomers]);

  const formattedCartSubtotal = useMemo(
    () =>
      new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
      }).format(cartSubtotal),
    [cartSubtotal],
  );

  const categories = useMemo(
    () =>
      buildSystemHubCategories({
        cartItems: cartItems.length,
        kdsOrders: kdsOrders.length,
        adminOrders: adminOrders.length,
        customers: customers.length,
      }),
    [cartItems.length, kdsOrders.length, adminOrders.length, customers.length],
  );

  const filteredCategories = useMemo(
    () => filterSystemHubCategories(categories, searchTerm, selectedCategory),
    [categories, searchTerm, selectedCategory],
  );

  const totalSections = countSystemHubSections(categories);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
  };

  return (
    <>
      <HelmetHead
        title="Trạm Điều Hành & Danh Mục Hệ Thống — AURA CAFE"
        description="Bảng điều hướng tổng hợp toàn bộ các phân hệ: Bếp/Pha chế KDS, Cổng Quản trị Admin, Thu ngân POS, Sơ đồ bàn, CRM khách hàng và Báo cáo."
        canonical="/portal"
      />

      <div className="min-h-screen bg-[#071320] text-[#E8EEF3] pb-24 selection:bg-[#6B9FB8]/30">
        {/* Ambient background glows */}
        <div className="fixed top-0 left-1/4 w-[600px] h-[400px] bg-[#6B9FB8]/10 blur-[140px] pointer-events-none rounded-full" />
        <div className="fixed bottom-10 right-1/4 w-[500px] h-[350px] bg-[#CD7F32]/10 blur-[140px] pointer-events-none rounded-full" />

        <SystemHubTopBar />

        <SystemHubHeroTelemetry
          cartItems={cartItems.length}
          formattedCartSubtotal={formattedCartSubtotal}
          kdsOrders={kdsOrders.length}
          customers={customers.length}
        />

        <DataSyncArchitectureStrip />

        <SystemHubSearchFilter
          categories={categories}
          searchTerm={searchTerm}
          selectedCategory={selectedCategory}
          totalSections={totalSections}
          onSearchTermChange={setSearchTerm}
          onSelectedCategoryChange={setSelectedCategory}
        />

        {/* ── Category Sections ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-12">
          <SystemHubCategoryGrid categories={filteredCategories} onResetFilters={resetFilters} />
        </div>

        <SystemHubFooter />
      </div>
    </>
  );
}
