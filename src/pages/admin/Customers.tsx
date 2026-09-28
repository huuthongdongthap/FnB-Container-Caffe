import { Users, UserPlus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useAdminCustomersStore } from '@/hooks/stores/admin/use-admin-customers-store';
import { CustomerTable } from '@/components/admin/CustomerTable';
import { CustomerModal } from '@/components/admin/CustomerModal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { AdminCustomer } from '@/hooks/use-admin';

export default function AdminCustomersPage() {
  const { t } = useTranslation('adminCustomers');
  const {
    customers,
    loading,
    error,
    fetchCustomers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
  } = useAdminCustomersStore();

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<AdminCustomer | null>(null);

  const TIER_OPTIONS = [
    { value: '', label: t('allTiers') },
    { value: 'VIP', label: 'VIP' },
    { value: 'LOYAL', label: t('loyal') },
    { value: 'REGULAR', label: t('regular') },
  ];

  useEffect(() => {
    fetchCustomers(1, search || undefined);
  }, [fetchCustomers]);

  const handleSearch = (value: string) => {
    setSearch(value);
    fetchCustomers(1, value || undefined);
  };

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (customer: AdminCustomer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleDelete = async (customer: AdminCustomer) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa khách hàng "${customer.name}" không?`)) {
      await deleteCustomer(customer.id);
    }
  };

  const handleSaveCustomer = async (data: { name: string; phone: string; tier: string }) => {
    if (editingCustomer) {
      return await updateCustomer(editingCustomer.id, data);
    }
    return await addCustomer(data);
  };

  return (
    <>
      <HelmetHead
        title="Quản lý khách hàng — Customer Management — AURA CAFE"
        description="Quản lý thông tin và phân loại khách hàng tại AURA CAFE. Customer data management & tier classification."
      />
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-display font-bold">{t('title')}</h1>
              <p className="text-sm text-muted mt-0.5">
                {loading ? t('loading') : t('customerCount', { count: customers.length })}
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              onClick={handleOpenAdd}
              className="flex items-center gap-2 cursor-pointer shadow-sm self-start sm:self-auto"
            >
              <UserPlus className="w-4 h-4" />
              <span>Thêm Khách Hàng</span>
            </Button>
          </div>

          {/* Error state */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
              {error}
              <button
                onClick={() => fetchCustomers(1)}
                className="ml-3 underline hover:no-underline"
              >
                {t('retry')}
              </button>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-xl border border-border p-4 mb-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t('search')}</label>
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t('tierFilter')}</label>
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {TIER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Customer Table or Empty State */}
          {!loading && !error && customers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-white/40 p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/10">
                <Users size={28} aria-hidden="true" className="text-muted" />
              </div>
              <h3 className="mb-1 font-display text-lg font-semibold">{t('emptyTitle')}</h3>
              <p className="mb-4 text-sm text-muted/60">
                {search || tierFilter
                  ? t('emptyFiltered')
                  : t('emptyNoOrders')}
              </p>
              {(search || tierFilter) && (
                <button
                  onClick={() => { setSearch(''); setTierFilter(''); fetchCustomers(1); }}
                  className="text-sm text-accent underline underline-offset-2 hover:text-accent-warm"
                >
                  {t('clearFilters')}
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <CustomerTable
                customers={customers}
                tierFilter={tierFilter || undefined}
                searchQuery={search}
                onEdit={handleOpenEdit}
                onDelete={handleDelete}
              />
            </div>
          )}
        </div>
      </div>

      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveCustomer}
        customer={editingCustomer}
      />
    </>
  );
}
