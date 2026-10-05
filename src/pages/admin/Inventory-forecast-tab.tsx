import { Cpu, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ForecastItem } from './inventory-types';

interface InventoryForecastTabProps {
  forecastItems: ForecastItem[];
  loading?: boolean;
}

export function InventoryForecastTab({
  forecastItems,
  loading,
}: Readonly<InventoryForecastTabProps>) {
  return (
    <div className="space-y-4">
      {/* AI banner */}
      <div className="p-4 rounded-xl border border-[var(--glass-border)] bg-[rgba(201,214,223,0.04)] flex items-start gap-3">
        <Cpu className="w-5 h-5 text-[var(--aura-chrome-light)] mt-0.5 shrink-0" />
        <div className="text-xs text-[var(--aura-text-muted)] space-y-1">
          <p className="font-semibold text-[var(--aura-text-primary)]">
            Dự báo tiêu hao tự động bằng Trí tuệ nhân tạo (Edge AI)
          </p>
          <p>
            Mô hình phân tích lịch sử biến động kho trong 7 ngày gần nhất, kết hợp tốc độ bán hàng tại quầy để tính toán số ngày tồn khả dụng (Days-of-Supply) và đề xuất số lượng đặt hàng an toàn (Safety Stock Reorder).
          </p>
        </div>
      </div>

      {/* Forecast Table */}
      <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[var(--aura-text-primary)]">
            <thead className="bg-white/5 border-b border-[var(--glass-border)] text-[var(--aura-text-muted)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Mã SKU</th>
                <th className="py-3 px-4">Tên mặt hàng</th>
                <th className="py-3 px-4 text-right">Tồn hiện tại</th>
                <th className="py-3 px-4 text-right">Tốc độ tiêu hao / ngày</th>
                <th className="py-3 px-4 text-right">Số ngày tồn còn lại (DOS)</th>
                <th className="py-3 px-4 text-center">Cảnh báo rủi ro</th>
                <th className="py-3 px-4 text-right">Đề xuất đặt lại (AI)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]">
              {loading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--aura-text-muted)]">
                    Đang tính toán dự báo tiêu hao AI...
                  </td>
                </tr>
              )}
              {!loading && forecastItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--aura-text-muted)]">
                    Chưa có đủ dữ liệu lịch sử để dự báo
                  </td>
                </tr>
              )}
              {!loading &&
                forecastItems.map((item) => {
                  const risk = item.risk_level || 'HEALTHY';
                  const isCritical = risk === 'CRITICAL';
                  const isWarning = risk === 'WARNING';

                  return (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-mono text-[var(--aura-chrome-light)]">
                        {item.sku}
                      </td>
                      <td className="py-3 px-4 font-medium">{item.name}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {item.current_stock.toLocaleString()} {item.unit || 'đv'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[var(--aura-text-muted)]">
                        {item.daily_run_rate ?? '0.00'} / ngày
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span className={
                          isCritical ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
                        }>
                          {item.days_of_supply !== undefined && item.days_of_supply < 900
                            ? `${item.days_of_supply} ngày`
                            : '> 30 ngày'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isCritical ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300">
                            <AlertTriangle className="w-3 h-3" />
                            Nguy cấp (&le; 2 ngày)
                          </span>
                        ) : isWarning ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300">
                            <AlertTriangle className="w-3 h-3" />
                            Cảnh báo (&le; 5 ngày)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            An toàn
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-sky-400">
                        {item.recommended_reorder_qty
                          ? `+${item.recommended_reorder_qty} ${item.unit || ''}`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
