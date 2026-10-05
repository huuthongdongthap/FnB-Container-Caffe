import { Building2, ShoppingBag } from 'lucide-react';
import { formatVnd } from '@/lib/format';
import type { SupplierItem, PurchaseOrderItem } from './inventory-types';

interface InventorySuppliersTabProps {
  suppliers: SupplierItem[];
  purchaseOrders: PurchaseOrderItem[];
  loading?: boolean;
}

export function InventorySuppliersTab({
  suppliers,
  purchaseOrders,
  loading,
}: Readonly<InventorySuppliersTabProps>) {
  const poStatusBadge: Record<string, string> = {
    draft: 'bg-white/10 text-white',
    ordered: 'bg-sky-500/20 text-sky-300',
    received: 'bg-emerald-500/20 text-emerald-300',
    cancelled: 'bg-rose-500/20 text-rose-300',
  };

  return (
    <div className="space-y-6">
      {/* Suppliers section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-[var(--aura-chrome-light)]" />
          <h3 className="text-sm font-semibold font-display uppercase tracking-wider text-[var(--aura-chrome-light)]">
            Danh sách Nhà cung cấp ({suppliers.length})
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading && (
            <div className="col-span-full py-6 text-center text-xs text-[var(--aura-text-muted)]">
              Đang tải danh sách nhà cung cấp...
            </div>
          )}
          {!loading && suppliers.length === 0 && (
            <div className="col-span-full py-6 text-center text-xs text-[var(--aura-text-muted)]">
              Chưa có nhà cung cấp nào
            </div>
          )}
          {!loading &&
            suppliers.map((sup) => (
              <div
                key={sup.id}
                className="p-4 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] space-y-2"
              >
                <div className="flex items-start justify-between">
                  <h4 className="font-semibold text-sm text-[var(--aura-text-primary)]">
                    {sup.name}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300">
                    Hoạt động
                  </span>
                </div>
                <div className="text-xs text-[var(--aura-text-muted)] space-y-1">
                  <p>Người liên hệ: {sup.contact_person || 'Chưa cập nhật'}</p>
                  <p>Điện thoại: {sup.phone || 'Chưa cập nhật'}</p>
                  <p>Email: {sup.email || 'Chưa cập nhật'}</p>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Purchase Orders section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ShoppingBag className="w-4 h-4 text-[var(--aura-chrome-light)]" />
          <h3 className="text-sm font-semibold font-display uppercase tracking-wider text-[var(--aura-chrome-light)]">
            Đơn mua hàng / Purchase Orders ({purchaseOrders.length})
          </h3>
        </div>

        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[var(--aura-text-primary)]">
              <thead className="bg-white/5 border-b border-[var(--glass-border)] text-[var(--aura-text-muted)] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Mã đơn PO</th>
                  <th className="py-3 px-4">Nhà cung cấp</th>
                  <th className="py-3 px-4">Ngày đặt</th>
                  <th className="py-3 px-4 text-right">Tổng giá trị</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border)]">
                {loading && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[var(--aura-text-muted)]">
                      Đang tải đơn đặt hàng...
                    </td>
                  </tr>
                )}
                {!loading && purchaseOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[var(--aura-text-muted)]">
                      Chưa có đơn mua hàng nào
                    </td>
                  </tr>
                )}
                {!loading &&
                  purchaseOrders.map((po) => (
                    <tr key={po.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-[var(--aura-chrome-light)]">
                        {po.po_number}
                      </td>
                      <td className="py-3 px-4">{po.supplier_name || 'Nhà cung cấp đối tác'}</td>
                      <td className="py-3 px-4 font-mono text-[var(--aura-text-muted)]">
                        {po.order_date}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {formatVnd(po.total)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          poStatusBadge[po.status] || 'bg-white/10 text-white'
                        }`}>
                          {po.status}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
