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
    <Card className="border-amber-500/30 bg-amber-500/10">
      <CardHeader>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            Thanh toán treo
          </span>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-200">
            {data.total}
          </span>
        </button>
      </CardHeader>

      {expanded && (
        <CardBody>
          {data.stuck.length > 0 && (
            <div className="mb-3">
              <p className="mb-2 text-xs font-medium text-amber-300">
                Sai khớp số tiền ({data.stuck.length})
              </p>
              <ul className="space-y-1 text-xs text-amber-200/80">
                {data.stuck.slice(0, 5).map((s) => (
                  <li key={s.orderId} className="flex justify-between">
                    <span>#{s.orderId}</span>
                    <span className="tabular-nums">
                      DB: {typeof s.dbAmount === 'number' ? `${s.dbAmount.toLocaleString('vi-VN')}₫` : (s.dbAmount ?? s.amount ?? '***')} ≠ Hook: {typeof s.webhookAmount === 'number' ? `${s.webhookAmount.toLocaleString('vi-VN')}₫` : (s.webhookAmount ?? '***')}
                    </span>
                  </li>
                ))}
                {data.stuck.length > 5 && (
                  <li className="text-amber-300">
                    ...và {data.stuck.length - 5} giao dịch khác
                  </li>
                )}
              </ul>
            </div>
          )}

          {data.dlq.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-amber-300">
                Lỗi webhook ({data.dlq.length})
              </p>
              <ul className="space-y-1 text-xs text-amber-200/80">
                {data.dlq.slice(0, 5).map((d) => (
                  <li key={d.key} className="truncate">
                    <span className="font-mono text-[10px]">{d.key.replace('webhook:dlq:', '')}</span>
                    {d.error && <span className="ml-2">{d.error.slice(0, 60)}</span>}
                  </li>
                ))}
                {data.dlq.length > 5 && (
                  <li className="text-amber-300">
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
