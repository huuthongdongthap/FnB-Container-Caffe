import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';

interface StuckPayment {
  orderId: string;
  orderCode: string | number;
  dbAmount: number;
  webhookAmount: number;
  detectedAt: string;
  amount?: string;
}

interface DlqEntry {
  key: string;
  error?: string;
  stack?: string;
  timestamp?: string;
}

interface StuckPaymentsData {
  stuck: StuckPayment[];
  dlq: DlqEntry[];
  total: number;
}

export function StuckPaymentsCard() {
  const [data, setData] = useState<StuckPaymentsData | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    apiFetch<StuckPaymentsData>('/api/admin/payments/stuck')
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data || data.total === 0) return null;

  return (
    <Card className="border-amber-300 bg-amber-50/30">
      <CardHeader>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            Thanh toán treo
          </span>
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
            {data.total}
          </span>
        </button>
      </CardHeader>

      {expanded && (
        <CardBody>
          {data.stuck.length > 0 && (
            <div className="mb-3">
              <p className="mb-2 text-xs font-medium text-amber-700">
                Sai khớp số tiền ({data.stuck.length})
              </p>
              <ul className="space-y-1 text-xs text-amber-800/80">
                {data.stuck.slice(0, 5).map((s) => (
                  <li key={s.orderId} className="flex justify-between">
                    <span>#{s.orderId}</span>
                    <span className="tabular-nums">
                      DB: {s.dbAmount?.toLocaleString('vi-VN')}₫ ≠ Hook: {s.webhookAmount?.toLocaleString('vi-VN')}₫
                    </span>
                  </li>
                ))}
                {data.stuck.length > 5 && (
                  <li className="text-amber-600">
                    ...và {data.stuck.length - 5} giao dịch khác
                  </li>
                )}
              </ul>
            </div>
          )}

          {data.dlq.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-amber-700">
                Lỗi webhook ({data.dlq.length})
              </p>
              <ul className="space-y-1 text-xs text-amber-800/80">
                {data.dlq.slice(0, 5).map((d) => (
                  <li key={d.key} className="truncate">
                    <span className="font-mono text-[10px]">{d.key.replace('webhook:dlq:', '')}</span>
                    {d.error && <span className="ml-2">{d.error.slice(0, 60)}</span>}
                  </li>
                ))}
                {data.dlq.length > 5 && (
                  <li className="text-amber-600">
                    ...và {data.dlq.length - 5} lỗi khác
                  </li>
                )}
              </ul>
            </div>
          )}
        </CardBody>
      )}
    </Card>
  );
}
