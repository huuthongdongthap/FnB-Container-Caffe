import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter } from 'lucide-react';
import type { LoyaltyHistoryEntry } from './stitch-loyalty-types';
import type { CashbackTransactionEntry } from '@/hooks/stores/loyalty-store-types';
import { PointsHistoryTable } from './loyalty-points-history';

export function PointsHistorySection({
  history,
  cashbackHistory = [],
}: {
  history: LoyaltyHistoryEntry[];
  cashbackHistory?: CashbackTransactionEntry[];
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'points' | 'cashback'>('points');

  return (
    <section
      className="rounded-xl p-[24px] overflow-hidden"
      data-glass="card"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--aura-bg-high) 40%, transparent)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid color-mix(in srgb, var(--aura-glass-bg) 5%, transparent)',
      }}
    >
      <div className="flex flex-wrap justify-between items-center gap-3 mb-[24px]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="tab-points-history"
            onClick={() => setActiveTab('points')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'points'
                ? 'bg-[var(--aura-chrome-bright)] text-[var(--aura-noir-deep)]'
                : 'bg-white/5 text-[var(--aura-chrome-soft)] hover:text-white'
            }`}
          >
            {t('loyalty.pointsHistory', { defaultValue: 'Lịch sử điểm' })}
          </button>
          <button
            type="button"
            data-testid="tab-cashback-history"
            onClick={() => setActiveTab('cashback')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'cashback'
                ? 'bg-[#C69C6D] text-[#0A1A2E]'
                : 'bg-white/5 text-[var(--aura-chrome-soft)] hover:text-white'
            }`}
          >
            Lịch sử hoàn tiền ({cashbackHistory.length})
          </button>
        </div>
        <button
          type="button"
          className="cursor-pointer hover:text-[var(--aura-chrome-bright)] transition-colors"
          style={{ color: 'var(--aura-chrome-soft)' }}
          aria-label={t('loyalty.filterHistoryAria')}
        >
          <Filter className="h-5 w-5" />
        </button>
      </div>

      {activeTab === 'points' ? (
        <PointsHistoryTable history={history} />
      ) : cashbackHistory.length === 0 ? (
        <p data-testid="cashback-history-empty" className="text-sm text-[var(--aura-chrome-soft)] py-6 text-center">
          Chưa có giao dịch hoàn tiền nào. Đặt món tại AURA CAFE để tích lũy hoàn tiền tự động!
        </p>
      ) : (
        <div className="divide-y divide-white/10" data-testid="cashback-history-list">
          {cashbackHistory.map((tx) => {
            const isCredit = tx.type === 'earn' || tx.type === 'bonus' || (tx.amount > 0 && tx.type !== 'spend');
            const absAmount = Math.abs(tx.amount);
            const label =
              tx.type === 'spend'
                ? 'Sử dụng ví hoàn tiền'
                : tx.type === 'bonus'
                  ? 'Thưởng thành viên'
                  : tx.type === 'expire'
                    ? 'Hoàn tiền hết hạn'
                    : 'Hoàn tiền đơn hàng';
            return (
              <div key={tx.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[var(--aura-chrome-bright)]">
                    {tx.description || label}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[var(--aura-chrome-soft)]">
                    {tx.createdAt && <span>{tx.createdAt.slice(0, 10)}</span>}
                    {tx.orderId && (
                      <span className="px-2 py-0.5 rounded bg-white/10 font-mono text-[11px]">
                        Đơn #{tx.orderId.slice(-8)}
                      </span>
                    )}
                    {tx.expiresAt && isCredit && (
                      <span className="text-amber-300/90">
                        HSD: {tx.expiresAt.slice(0, 10)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p
                    className={`text-sm font-bold ${
                      isCredit ? 'text-emerald-400' : 'text-rose-300'
                    }`}
                  >
                    {isCredit ? '+' : '-'}
                    {absAmount.toLocaleString('vi-VN')}₫
                  </p>
                  <p className="text-[11px] text-[var(--aura-chrome-soft)]">
                    Số dư sau GD: {tx.balanceAfter.toLocaleString('vi-VN')}₫
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
