import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check, Ticket, ArrowRight } from 'lucide-react';
import type { RedeemedVoucher } from '@/hooks/stores/loyalty-store-types';

interface MyVouchersSectionProps {
  vouchers: RedeemedVoucher[];
  title?: string;
  compact?: boolean;
}

const STATUS_BADGE: Record<RedeemedVoucher['status'], { label: string; className: string }> = {
  active: { label: 'Chưa dùng', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  used: { label: 'Đã dùng', className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
  expired: { label: 'Hết hạn', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

export function MyVouchersSection({ vouchers, title = 'Voucher của tôi', compact = false }: MyVouchersSectionProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard?.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((prev) => (prev === code ? null : prev)), 2000);
    } catch {
      // Clipboard may be unavailable in non-HTTPS environments
    }
  };

  return (
    <section
      data-testid="my-vouchers-section"
      className={`rounded-2xl border border-[#C69C6D]/20 bg-[#1B1714]/80 ${compact ? 'p-4' : 'p-6'}`}
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-[#C69C6D]" />
          <h3 className="text-base font-semibold text-[#F5EFE6]">{title}</h3>
        </div>
        <span className="text-xs text-[#C69C6D]/80">{vouchers.length} mã</span>
      </div>

      {vouchers.length === 0 ? (
        <p className="text-sm text-[#A89F91]">
          Bạn chưa có voucher nào. Hãy đổi điểm thưởng để nhận mã ưu đãi.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {vouchers.map((voucher) => {
            const badge = STATUS_BADGE[voucher.status] ?? STATUS_BADGE.active;
            const expiryText = voucher.expiresAt
              ? new Date(voucher.expiresAt).toLocaleDateString('vi-VN')
              : 'Không giới hạn';
            const isActive = voucher.status === 'active';

            return (
              <div
                key={voucher.id || voucher.code}
                data-testid={`voucher-card-${voucher.code}`}
                className="rounded-xl border border-[#C69C6D]/20 bg-[#120F0D] p-3.5 flex flex-col justify-between gap-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#F5EFE6] truncate">{voucher.title}</p>
                    <p className="font-mono text-xs font-semibold text-[#C69C6D] mt-0.5 select-all">
                      {voucher.code}
                    </p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs text-[#A89F91]">
                  <span>HSD: {expiryText}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopy(voucher.code)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#C69C6D]/15 hover:bg-[#C69C6D]/25 text-[#F5EFE6] transition-colors"
                      aria-label={`Sao chép mã ${voucher.code}`}
                    >
                      {copiedCode === voucher.code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode === voucher.code ? 'Đã chép' : 'Sao chép'}</span>
                    </button>
                    {isActive && (
                      <Link
                        to={`/checkout?promo=${encodeURIComponent(voucher.code)}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#C69C6D] text-[#120F0D] font-semibold hover:bg-[#D4AD7E] transition-colors"
                      >
                        <span>Dùng ngay</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
