import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import type { AdminCustomer } from '@/hooks/use-admin';

interface CustomerTableProps {
  customers: AdminCustomer[];
  tierFilter?: string;
  searchQuery?: string;
  className?: string;
}

export function CustomerTable({ customers, tierFilter, searchQuery = '', className }: CustomerTableProps) {
  const filtered = useMemo(() => {
    let result = [...customers];

    if (tierFilter) {
      result = result.filter((c) => c.tier === tierFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q)
      );
    }

    return result;
  }, [customers, tierFilter, searchQuery]);

  if (customers.length === 0) {
    return (
      <div className="text-center py-8 text-muted">
        <span className="text-3xl block mb-2">&#128101;</span>
        <p className="text-sm">Không có khách hàng</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 font-medium text-muted uppercase text-xs tracking-wider">Tên</th>
              <th className="text-left py-2 px-3 font-medium text-muted uppercase text-xs tracking-wider">SĐT</th>
              <th className="text-center py-2 px-3 font-medium text-muted uppercase text-xs tracking-wider">Đơn hàng</th>
              <th className="text-right py-2 px-3 font-medium text-muted uppercase text-xs tracking-wider">Tổng chi</th>
              <th className="text-center py-2 px-3 font-medium text-muted uppercase text-xs tracking-wider">Hạng</th>
              <th className="text-center py-2 px-3 font-medium text-muted uppercase text-xs tracking-wider">Gần nhất</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((customer) => (
              <tr key={customer.id} className="border-b border-border/60 hover:bg-muted/10">
                <td className="py-2.5 px-3 font-medium">{customer.name}</td>
                <td className="py-2.5 px-3 font-mono text-xs">{customer.phone}</td>
                <td className="py-2.5 px-3 text-center">{customer.totalOrders}</td>
                <td className="py-2.5 px-3 text-right font-mono">
                  {customer.totalSpent.toLocaleString('vi-VN')}₫
                </td>
                <td className="py-2.5 px-3 text-center">
                  <Badge variant={customer.tier === 'VIP' ? 'info' : customer.tier === 'PLATINUM' ? 'warning' : 'default'}>
                    {customer.tier}
                  </Badge>
                </td>
                <td className="py-2.5 px-3 text-center text-xs text-muted">
                  {customer.lastVisit
                    ? new Date(customer.lastVisit).toLocaleDateString('vi-VN')
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-6 text-muted">
          <p className="text-sm">Không tìm thấy khách hàng phù hợp</p>
        </div>
      )}
    </div>
  );
}
