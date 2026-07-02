import { Card } from '@/components/ui/card';
import { formatVnd } from '@/lib/format';

export interface CustomerMetricsData {
  total_customers: number;
  new_customers_30d: number;
  repeat_customers: number;
  repeat_rate: number;
  avg_spend_per_customer: number;
  avg_orders_per_customer: number;
}

interface CustomerMetricsCardProps {
  data: CustomerMetricsData | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function CustomerMetrics({ data, loading, error, onRetry }: CustomerMetricsCardProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4">
            <div className="h-12 bg-gray-200 rounded animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
          Khách hàng
        </h3>
        <div className="text-center py-4">
          <p className="text-sm text-red-500 mb-2">Lỗi tải dữ liệu</p>
          {onRetry && (
            <button onClick={onRetry} className="text-xs text-blue-600 underline">
              Thử lại
            </button>
          )}
        </div>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div>
      <h2 className="text-lg font-display font-semibold mb-3">Khách hàng</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 flex flex-col">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Tổng khách
          </span>
          <span className="text-xl font-bold font-display text-gray-800">
            {data.total_customers.toLocaleString('vi-VN')}
          </span>
          <span className="text-[10px] text-gray-400 mt-0.5">👥</span>
        </Card>
        <Card className="p-4 flex flex-col">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Khách mới (30d)
          </span>
          <span className="text-xl font-bold font-display text-green-600">
            +{data.new_customers_30d.toLocaleString('vi-VN')}
          </span>
          <span className="text-[10px] text-gray-400 mt-0.5">🆕</span>
        </Card>
        <Card className="p-4 flex flex-col">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Quay lại
          </span>
          <span className="text-xl font-bold font-display text-amber-600">
            {data.repeat_rate}%
          </span>
          <span className="text-[10px] text-gray-400 mt-0.5">🔄</span>
        </Card>
        <Card className="p-4 flex flex-col">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Chi tiêu TB
          </span>
          <span className="text-xl font-bold font-display text-blue-600">
            {formatVnd(data.avg_spend_per_customer)}
          </span>
          <span className="text-[10px] text-gray-400 mt-0.5">💰</span>
        </Card>
      </div>
    </div>
  );
}
