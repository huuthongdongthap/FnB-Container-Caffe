'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { apiFetch } from '@/lib/api-client';
import { Package, History, Building2, Cpu } from 'lucide-react';
import type {
  IngredientItem,
  StockMovementItem,
  SupplierItem,
  PurchaseOrderItem,
  InventoryStats,
  ForecastItem,
  InventoryTab,
} from './inventory-types';
import { InventoryStatsCards } from './Inventory-stats-cards';
import { InventoryIngredientsTab } from './Inventory-ingredients-tab';
import { InventoryMovementsTab } from './Inventory-movements-tab';
import { InventorySuppliersTab } from './Inventory-suppliers-tab';
import { InventoryForecastTab } from './Inventory-forecast-tab';
import { InventoryMovementModal } from './Inventory-movement-modal';

const TABS: Array<{ id: InventoryTab; label: string; icon: typeof Package }> = [
  { id: 'overview', label: 'Tồn kho nguyên liệu', icon: Package },
  { id: 'movements', label: 'Lịch sử biến động', icon: History },
  { id: 'suppliers', label: 'Nhà cung cấp & Đơn mua', icon: Building2 },
  { id: 'forecasting', label: 'Dự báo tiêu hao AI', icon: Cpu },
];

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<InventoryTab>('overview');
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const ingredientsQ = useQuery<{ success: boolean; data: IngredientItem[] }>({
    queryKey: ['admin-inventory-ingredients'],
    queryFn: () => apiFetch('/api/inventory/ingredients?limit=100'),
  });
  const movementsQ = useQuery<{ success: boolean; data: StockMovementItem[] }>({
    queryKey: ['admin-inventory-movements'],
    queryFn: () => apiFetch('/api/inventory/movements?limit=50'),
  });
  const suppliersQ = useQuery<{ success: boolean; data: SupplierItem[] }>({
    queryKey: ['admin-inventory-suppliers'],
    queryFn: () => apiFetch('/api/inventory/suppliers?limit=50'),
    enabled: activeTab === 'suppliers',
  });
  const purchaseOrdersQ = useQuery<{ success: boolean; data: PurchaseOrderItem[] }>({
    queryKey: ['admin-inventory-pos'],
    queryFn: () => apiFetch('/api/inventory/purchase-orders?limit=50'),
    enabled: activeTab === 'suppliers',
  });
  const forecastQ = useQuery<{ success: boolean; data: ForecastItem[] }>({
    queryKey: ['admin-inventory-forecast'],
    queryFn: () => apiFetch('/api/inventory/forecasting/run-rate'),
    enabled: activeTab === 'forecasting',
  });

  const ingredients = useMemo(() => ingredientsQ.data?.data || [], [ingredientsQ.data]);
  const movements = useMemo(() => movementsQ.data?.data || [], [movementsQ.data]);
  const suppliers = useMemo(() => suppliersQ.data?.data || [], [suppliersQ.data]);
  const purchaseOrders = useMemo(() => purchaseOrdersQ.data?.data || [], [purchaseOrdersQ.data]);
  const forecastItems = useMemo(() => forecastQ.data?.data || [], [forecastQ.data]);

  const stats: InventoryStats = useMemo(() => {
    let low = 0;
    let out = 0;
    let val = 0;
    for (const it of ingredients) {
      if (it.current_stock <= 0) out++;
      else if (it.current_stock <= it.min_stock) low++;
      val += (it.current_stock || 0) * (it.cost_per_unit || 0);
    }
    return { totalItems: ingredients.length, lowStockCount: low, outOfStockCount: out, totalValue: val };
  }, [ingredients]);

  const handleSubmitMovement = async (payload: {
    ingredientId: string;
    type: 'in' | 'out' | 'adjust' | 'waste';
    quantity: number;
    notes?: string;
  }) => {
    await apiFetch('/api/inventory/movements', { method: 'POST', body: JSON.stringify(payload) });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-inventory-ingredients'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-inventory-movements'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-inventory-forecast'] }),
    ]);
  };

  return (
    <>
      <HelmetHead title="Quản lý kho — AURA CAFE" description="Quản lý tồn kho nguyên liệu AURA CAFE." />
      <div className="min-h-screen bg-[var(--aura-bg-base)] p-6">
        <div className="mx-auto max-w-[1400px] space-y-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--aura-text-primary)]">
              Quản lý kho hàng & Nguyên vật liệu
            </h1>
            <p className="text-xs text-[var(--aura-text-muted)] mt-1">
              Theo dõi định mức tồn kho, lịch sử biến động và dự báo tiêu hao tự động
            </p>
          </div>

          <InventoryStatsCards stats={stats} loading={ingredientsQ.isLoading} />

          <div className="flex items-center gap-2 border-b border-[var(--glass-border)] pb-2 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                    isActive
                      ? 'bg-[var(--aura-chrome-light,#c9d6df)] text-black shadow-sm'
                      : 'bg-white/5 text-[var(--aura-text-muted)] hover:bg-white/10 hover:text-[var(--aura-text-primary)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {activeTab === 'overview' && (
            <InventoryIngredientsTab
              ingredients={ingredients}
              loading={ingredientsQ.isLoading}
              onOpenMovement={(item) => { setSelectedIngredient(item); setIsModalOpen(true); }}
            />
          )}
          {activeTab === 'movements' && (
            <InventoryMovementsTab movements={movements} loading={movementsQ.isLoading} />
          )}
          {activeTab === 'suppliers' && (
            <InventorySuppliersTab
              suppliers={suppliers}
              purchaseOrders={purchaseOrders}
              loading={suppliersQ.isLoading || purchaseOrdersQ.isLoading}
            />
          )}
          {activeTab === 'forecasting' && (
            <InventoryForecastTab forecastItems={forecastItems} loading={forecastQ.isLoading} />
          )}
        </div>
      </div>

      <InventoryMovementModal
        ingredient={selectedIngredient}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitMovement}
      />
    </>
  );
}
