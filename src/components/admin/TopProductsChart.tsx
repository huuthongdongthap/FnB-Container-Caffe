import { Card } from '@/components/ui/card';
import { formatVnd } from '@/lib/format';

interface TopProduct {
  name: string;
  qty: number;
  revenue: number;
}

interface TopProductsChartProps {
  data: TopProduct[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function TopProductsChart({ data, loading, error, onRetry }: TopProductsChartProps) {
  if (loading) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
          Sản phẩm bán chạy
        </h3>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
          Sản phẩm bán chạy
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

  if (data.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
          Sản phẩm bán chạy
        </h3>
        <div className="text-center py-8 text-gray-400">
          <p className="text-sm">Chưa có dữ liệu</p>
        </div>
      </Card>
    );
  }

  const maxQty = Math.max(...data.map((d) => d.qty));

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
        Sản phẩm bán chạy
      </h3>
      <div className="space-y-2">
        {data.map((product, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-5 text-right font-mono">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-xs mb-1">
                <span className="truncate font-medium">{product.name}</span>
                <span className="text-gray-500 ml-2 whitespace-nowrap">
                  {product.qty} cái &middot; {formatVnd(product.revenue)}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
                  style={{ width: `${(product.qty / maxQty) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
