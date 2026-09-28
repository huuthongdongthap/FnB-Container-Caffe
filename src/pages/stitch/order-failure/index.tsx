import { LandingNav } from '@/components/stitch/StitchLandingNew-nav';
import { LandingFooter } from '@/components/stitch/StitchLandingNew-footer';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { AlertCircle, RotateCcw, QrCode, Banknote, MessageCircle, Phone } from 'lucide-react';

export default function OrderFailureNew() {
  return (
    <div className="relative min-h-screen bg-[var(--aura-noir-deep,#0a1a2e)] text-[var(--aura-chrome-bright)] selection:bg-[var(--aura-chrome-mid)] selection:text-[#0A1A2E] flex flex-col justify-between">
      <HelmetHead
        title="Thanh Toán Chưa Hoàn Tất — AURA CAFE"
        description="Thông báo lỗi thanh toán đơn hàng tại AURA CAFE. Quý khách có thể thử lại hoặc chọn phương thức thanh toán thay thế."
        canonical="/order-failure"
      />
      <LandingNav />

      <div role="region" aria-label="Thông Báo Thanh Toán" className="pt-28 pb-20 px-5 max-w-lg mx-auto w-full flex-1 flex flex-col justify-center">
        <div className="bg-white/5 backdrop-blur-[12px] border border-white/10 rounded-[32px] p-8 sm:p-10 border-t border-rose-500/40 shadow-2xl">
          {/* Error Hero */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto mb-5 text-rose-400">
              <AlertCircle className="w-9 h-9" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-rose-400 block mb-2">
              GIAO DỊCH CHƯA HOÀN TẤT
            </span>
            <h1 className="font-display text-3xl text-white font-semibold mb-3">
              Thanh Toán Thất Bại
            </h1>
            <p className="text-[var(--aura-chrome-soft)] text-sm max-w-sm mx-auto font-light leading-relaxed">
              Giao dịch chưa thể thực hiện được do lỗi kết nối hoặc thẻ bị từ chối. Quý khách vui lòng thử lại hoặc chọn phương thức khác.
            </p>
          </div>

          {/* Primary Action */}
          <div className="space-y-4 mb-8">
            <a
              href="/checkout"
              className="w-full py-4 rounded-2xl bg-[var(--aura-chrome-bright)] hover:bg-white text-[var(--aura-noir-deep)] font-body text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2.5 shadow-xl active:scale-[0.98]"
            >
              <RotateCcw className="w-4 h-4" />
              Thử Thanh Toán Lại
            </a>
            <a
              href="/menu"
              className="w-full py-3.5 rounded-2xl border border-white/15 hover:border-white/40 text-white font-body text-xs font-semibold uppercase tracking-widest text-center transition-all block"
            >
              Quay Lại Thực Đơn
            </a>
          </div>

          {/* Alternative Methods */}
          <div className="pt-6 border-t border-white/10 space-y-3 mb-8">
            <span className="text-[10px] uppercase tracking-widest text-[var(--aura-chrome-mid)] font-semibold block mb-2">
              PHƯƠNG THỨC THANH TOÁN THAY THẾ
            </span>

            <a
              href="/checkout?method=vietqr"
              className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[var(--aura-chrome-bright)]/40 transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[var(--aura-chrome-mid)]/15 border border-[var(--aura-chrome-mid)]/30 flex items-center justify-center text-[var(--aura-chrome-bright)]">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-body text-sm font-semibold text-white">Chuyển Khoản VietQR</p>
                  <p className="font-body text-xs text-[var(--aura-chrome-mid)]">Quét mã nhanh qua mọi app ngân hàng</p>
                </div>
              </div>
              <span className="text-xs text-[var(--aura-chrome-bright)] group-hover:translate-x-1 transition-transform">→</span>
            </a>

            <a
              href="/checkout?method=cash"
              className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[var(--aura-chrome-bright)]/40 transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[var(--aura-chrome-mid)]/15 border border-[var(--aura-chrome-mid)]/30 flex items-center justify-center text-[var(--aura-chrome-bright)]">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-body text-sm font-semibold text-white">Tiền Mặt Trực Tiếp</p>
                  <p className="font-body text-xs text-[var(--aura-chrome-mid)]">Thanh toán trực tiếp cho nhân viên phục vụ</p>
                </div>
              </div>
              <span className="text-xs text-[var(--aura-chrome-bright)] group-hover:translate-x-1 transition-transform">→</span>
            </a>
          </div>

          {/* Support */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 text-center">
            <span className="text-xs text-[var(--aura-chrome-soft)] block mb-3 font-light">
              Cần hỗ trợ đơn hàng ngay? Liên hệ nhân viên AURA CAFE:
            </span>
            <div className="flex justify-center gap-4">
              <a
                href="tel:0901234567"
                className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--aura-chrome-bright)] hover:underline"
              >
                <Phone className="w-3.5 h-3.5" />
                Hotline Hỗ Trợ
              </a>
              <span className="text-white/20">•</span>
              <a
                href="https://zalo.me"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--aura-chrome-bright)] hover:underline"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Chat Zalo
              </a>
            </div>
          </div>
        </div>
      </div>

      <LandingFooter />
    </div>
  );
}
