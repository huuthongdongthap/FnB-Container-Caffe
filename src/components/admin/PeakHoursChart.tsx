import { Card } from '@/components/ui/card';

interface PeakHour {
  hour: number;
  order_count: number;
  revenue: number;
}

interface PeakHoursChartProps {
  data: PeakHour[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function PeakHoursChart({ data, loading, error, onRetry }: PeakHoursChartProps) {
  if (loading) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
          Giờ cao điểm
        </h3>
        <div className="h-32 bg-gray-100 rounded animate-pulse" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
          Giờ cao điểm
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
          Giờ cao điểm
        </h3>
        <div className="text-center py-8 text-gray-400">
          <p className="text-sm">Chưa có dữ liệu</p>
        </div>
      </Card>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.order_count), 1);

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
        Giờ cao điểm
      </h3>
      <div className="flex items-end gap-0.5 h-32">
        {data.map((h) => {
          const height = (h.order_count / maxCount) * 100;
          return (
            <div key={h.hour} className="flex-1 flex flex-col items-center">
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${Math.max(height, 2)}%`,
                  backgroundColor: `hsl(221, 83%, ${60 - (1 - h.order_count / maxCount) * 30}%)`,
                }}
                title={`${h.hour}:00 - ${h.order_count} đơn`}
              />
              {[0, 6, 12, 18].includes(h.hour) && (
                <span className="text-[8px] text-gray-400 mt-1">{h.hour}</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-xs text-gray-400 text-center">
        {data.length} khung giờ
      </div>
    </Card>
  );
}
