import { useState, useEffect } from 'react';
import { useAdminCustomersStore } from '@/hooks/stores/admin/use-admin-customers-store';
import { CustomerTable } from '@/components/admin/CustomerTable';
import { Input } from '@/components/ui/input';

const TIER_OPTIONS = [
  { value: '', label: 'Tất cả hạng' },
  { value: 'VIP', label: 'VIP' },
  { value: 'LOYAL', label: 'Thân thiết' },
  { value: 'REGULAR', label: 'Thường' },
];

export default function AdminCustomersPage() {
  const { customers, loading, error, fetchCustomers } = useAdminCustomersStore();
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');

  useEffect(() => {
    fetchCustomers(1, search || undefined);
  }, [fetchCustomers]);

  const handleSearch = (value: string) => {
    setSearch(value);
    fetchCustomers(1, value || undefined);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-display font-bold">Quản lý khách hàng</h1>
          <span className="text-sm text-muted">
            {loading ? 'Đang tải...' : `${customers.length} khách`}
          </span>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
            {error}
            <button
              onClick={() => fetchCustomers(1)}
              className="ml-3 underline hover:no-underline"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-border p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Tìm kiếm</label>
              <Input
                placeholder="Tên hoặc SĐT..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Hạng thành viên</label>
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
              <span className="text-3xl">👥</span>
            </div>
            <h3 className="mb-1 font-display text-lg font-semibold">Chưa có khách hàng</h3>
            <p className="mb-4 text-sm text-muted/60">
              {search || tierFilter
                ? 'Không tìm thấy khách hàng phù hợp với bộ lọc hiện tại.'
                : 'Danh sách khách hàng sẽ xuất hiện sau khi có đơn hàng đầu tiên.'}
            </p>
            {(search || tierFilter) && (
              <button
                onClick={() => { setSearch(''); setTierFilter(''); fetchCustomers(1); }}
                className="text-sm text-accent underline underline-offset-2 hover:text-accent-warm"
              >
                Xoá bộ lọc
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <CustomerTable
              customers={customers}
              tierFilter={tierFilter || undefined}
              searchQuery={search}
            />
          </div>
        )}
      </div>
    </div>
  );
}
