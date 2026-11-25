import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { LandingNav } from '@/components/stitch/StitchLandingNew-nav';
import { LandingFooter } from '@/components/stitch/StitchLandingNew-footer';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { apiFetch } from '@/lib/api-client';
import { QrCode, Sparkles, Phone, ArrowRight, CheckCircle2, Store } from 'lucide-react';

export default function CheckinNew() {
  const [phone, setPhone] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);
  const [rewardAmount, setRewardAmount] = useState<number | null>(null);
  const [checkinStatus, setCheckinStatus] = useState<string | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
    if (error) setError(null);
  };

  const handleCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<{
        success?: boolean;
        ok?: boolean;
        status?: string;
        reward_amount?: number;
        points_earned?: number;
        points?: number;
        data?: {
          status?: string;
          reward_amount?: number;
          points_earned?: number;
          points?: number;
        };
        error?: string;
        message?: string;
      }>('/api/checkin', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      if (res.success === false || res.ok === false) {
        setError(res.error || res.message || 'Check-in thất bại. Vui lòng thử lại.');
        return;
      }
      const earned = res.points_earned ?? res.points ?? res.data?.points_earned ?? res.data?.points ?? null;
      const reward = res.reward_amount ?? res.data?.reward_amount ?? null;
      const status = res.status ?? res.data?.status ?? null;
      setPointsEarned(typeof earned === 'number' ? earned : null);
      setRewardAmount(typeof reward === 'number' ? reward : null);
      setCheckinStatus(typeof status === 'string' ? status : null);
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể kết nối máy chủ. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0A1A2E] text-[var(--aura-chrome-bright)] font-body selection:bg-[var(--aura-chrome-mid)] selection:text-[#0A1A2E] flex flex-col justify-between">
      <HelmetHead
        title="Tích Điểm Hội Viên &amp; Check-in — AURA CAFE"
        description="Tích lũy AURA Points cho mỗi lần ghé quán tại 29 Nguyễn Tất Thành, Sa Đéc. Nhận ưu đãi chiết khấu lên đến 10% cho thành viên Platinum."
        canonical="/checkin"
      />
      <LandingNav />

      <div role="region" aria-label="Tích Điểm Hội Viên" className="pt-28 pb-20 px-5 max-w-lg mx-auto w-full flex-1 flex flex-col justify-center">
        {isSuccess ? (
          <div className="bg-white/5 backdrop-blur-[12px] border border-white/10 rounded-[32px] p-8 sm:p-10 border-t border-[var(--aura-chrome-mid)]/40 text-center shadow-2xl animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-[#4A7C59]/20 border border-[#4A7C59] flex items-center justify-center mx-auto mb-6 text-[#4A7C59]">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <span
              data-testid="checkin-status-badge"
              className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#4A7C59] block mb-2"
            >
              {checkinStatus === 'pending' ? 'ĐÃ GHI NHẬN CHECK-IN • CHỜ DUYỆT' : 'TÍCH ĐIỂM THÀNH CÔNG'}
            </span>
            <h2 className="font-display text-3xl text-white font-semibold mb-3">
              Cảm Ơn Quý Khách!
            </h2>
            <p className="text-[var(--aura-chrome-soft)] text-sm max-w-sm mx-auto mb-6 font-light leading-relaxed">
              {checkinStatus === 'pending' ? (
                <>
                  Yêu cầu check-in cho số điện thoại{' '}
                  <span className="font-mono text-white font-semibold">{phone}</span> đã được ghi nhận
                  {rewardAmount !== null ? ` với mức thưởng +${rewardAmount.toLocaleString('vi-VN')} ₫` : ''} và đang chờ nhân viên xác nhận tại quầy.
                </>
              ) : (
                <>
                  Điểm thưởng
                  {pointsEarned !== null
                    ? ` (+${pointsEarned} điểm)`
                    : rewardAmount !== null
                      ? ` (+${rewardAmount.toLocaleString('vi-VN')} ₫)`
                      : ''}{' '}
                  của lượt ghé hôm nay đã được ghi nhận cho số điện thoại{' '}
                  <span className="font-mono text-white font-semibold">{phone}</span>.
                </>
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="/menu"
                className="bg-[var(--aura-chrome-bright)] hover:bg-white text-[var(--aura-noir-deep)] px-6 py-3 rounded-full font-body text-xs font-bold uppercase tracking-widest transition-all"
              >
                Khám Phá Menu
              </a>
              <button
                onClick={() => {
                  setIsSuccess(false);
                  setPhone('');
                  setRewardAmount(null);
                  setCheckinStatus(null);
                  setPointsEarned(null);
                }}
                className="border border-white/20 text-[var(--aura-chrome-bright)] hover:border-white px-6 py-3 rounded-full font-body text-xs font-semibold uppercase tracking-widest transition-all"
              >
                Nhập Số Khác
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 backdrop-blur-[12px] border border-white/10 rounded-[32px] p-8 sm:p-10 border-t border-[var(--aura-chrome-mid)]/40 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--aura-chrome-mid)]/10 border border-[var(--aura-chrome-mid)]/20 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-[var(--aura-chrome-bright)]" />
                <span className="text-[var(--aura-chrome-mid)] text-xs uppercase tracking-widest font-semibold">
                  Hội Viên AURA
                </span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl text-white font-semibold mb-3">
                Check-in Tích Điểm
              </h1>
              <p className="text-[var(--aura-chrome-soft)] text-sm font-light leading-relaxed">
                Nhập số điện thoại để tích lũy điểm thưởng <span className="text-[var(--aura-chrome-bright)] font-semibold">AURA Points</span> cho hoá đơn hôm nay tại Sa Đéc.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleCheckin} className="space-y-6">
              <div>
                <label htmlFor="phone" className="block text-xs font-bold uppercase tracking-widest text-[var(--aura-chrome-mid)] mb-2">
                  Số Điện Thoại
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--aura-chrome-mid)]">
                    <Phone className="w-5 h-5" />
                  </div>
                  <input
                    ref={phoneInputRef}
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="0912 345 678"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-lg font-mono text-white placeholder-[var(--aura-chrome-mid)]/40 focus:outline-none focus:border-[var(--aura-chrome-bright)] transition-colors"
                  />
                </div>
              </div>

              {error && (
                <div role="alert" className="rounded-xl border border-red-400/40 bg-red-500/15 px-4 py-3 text-xs text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={phone.length < 10 || submitting}
                className="w-full py-4 rounded-2xl bg-[var(--aura-chrome-bright)] text-[var(--aura-noir-deep)] font-body text-xs font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 shadow-xl hover:bg-white active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                {submitting ? 'Đang xử lý...' : 'Xác Nhận & Tích Điểm'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* QR Scanner visual option */}
            <div className="relative my-8 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative inline-block bg-[#0A1A2E] px-4 text-[10px] uppercase tracking-widest text-[var(--aura-chrome-mid)] font-semibold">
                Hoặc Quét Mã Tại Bàn
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/15 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[var(--aura-chrome-mid)]/10 border border-[var(--aura-chrome-mid)]/20 flex items-center justify-center text-[var(--aura-chrome-bright)] mb-3">
                <QrCode className="w-6 h-6" />
              </div>
              <p className="text-xs text-[var(--aura-chrome-soft)] font-light max-w-xs">
                Mỗi bàn tại AURA CAFE đều có sẵn mã QR riêng để quý khách mở thực đơn và tích điểm tự động.
              </p>
            </div>
          </div>
        )}

        {/* In-Store QR Promo Card for F&B Owners */}
        <aside
          aria-label="Giải pháp POS & QR Order cho chủ quán F&B"
          className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5 flex flex-col gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-500/10 text-amber-300">
              <Store className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300/90">
                AURA F&amp;B Platform
              </p>
              <p className="text-xs sm:text-sm text-[var(--aura-chrome-soft)] leading-relaxed">
                Bạn là chủ quán cà phê / F&amp;B? AURA CAFE Sa Đéc đang vận hành POS, QR Order &amp; KDS với 0% hoa hồng.
              </p>
            </div>
          </div>
          <Link
            to="/pricing?utm_source=instore&utm_medium=checkin_promo&utm_campaign=flagship_sadec_30d&utm_content=checkin_footer_card"
            className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/35 bg-amber-500/15 px-4 py-2.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 hover:text-white transition-colors"
          >
            <span>Xem bảng giá &amp; Dùng thử 14 ngày</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
          </Link>
        </aside>
      </div>

      <LandingFooter />
    </div>
  );
}
