import { useState } from 'react';
import { Mail, Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react';

export function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
  };

  return (
    <section className="px-4 sm:px-6 py-12 max-w-7xl mx-auto">
      <div
        className="rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(14,40,65,0.7) 0%, rgba(10,26,46,0.9) 100%)',
          border: '1px solid rgba(201, 214, 223, 0.18)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Ambient Decorative Glow */}
        <div
          className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: 'var(--aura-bronze-shimmer, #C9A96E)' }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-3xl">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.16em] mb-4"
            style={{
              background: 'rgba(201, 169, 110, 0.12)',
              border: '1px solid var(--aura-bronze-shimmer, #C9A96E)',
              color: 'var(--aura-bronze-shimmer, #C9A96E)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Câu Lạc Bộ Hội Viên Thân Thiết</span>
          </div>

          <h3
            className="text-2xl sm:text-4xl font-bold text-white mb-3 tracking-tight"
            style={{ fontFamily: 'var(--aura-font-display)' }}
          >
            Nhận Đặc Quyền VIP & Tin Sự Kiện Độc Quyền
          </h3>

          <p className="text-sm sm:text-base text-[var(--aura-chrome-soft)] mb-8 font-light leading-relaxed">
            Đăng ký để nhận voucher ưu đãi riêng theo mùa, vé mời các đêm nhạc Acoustic cuối tuần tại sân thượng Rooftop, và trải nghiệm menu món mới trước ngày ra mắt chính thức.
          </p>

          {submitted ? (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#4A7C59]/20 border border-[#4A7C59]/40 text-white animate-fade-in">
              <CheckCircle2 className="w-6 h-6 text-[#4A7C59] flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm">Cảm ơn bạn đã tham gia AURA VIP Club!</p>
                <p className="text-xs text-[var(--aura-chrome-soft)]">
                  Mã quà tặng chào mừng đã sẵn sàng khi bạn ghé quán.
                </p>
              </div>
            </div>
          ) : (
            <form className="flex flex-col sm:flex-row gap-3" onSubmit={handleSubmit}>
              <div className="relative flex-1">
                <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--aura-chrome-mid)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Nhập email hoặc số điện thoại của bạn..."
                  required
                  className="w-full pl-12 pr-4 py-4 rounded-full bg-black/40 border border-[var(--aura-chrome-mid)]/30 focus:border-[var(--aura-bronze-shimmer,#C9A96E)] focus:outline-none text-white text-sm placeholder:text-[var(--aura-chrome-mid)]/60 transition-colors shadow-inner"
                />
              </div>
              <button
                type="submit"
                className="px-8 py-4 rounded-full text-xs font-bold uppercase tracking-[0.16em] transition-all active:scale-95 hover:brightness-110 shadow-lg cursor-pointer flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #C9A96E 0%, #E2D4B7 50%, #C9A96E 100%)',
                  color: '#0A1A2E',
                }}
              >
                Đăng Ký Ngay
              </button>
            </form>
          )}

          <div className="flex items-center gap-4 mt-6 text-xs text-[var(--aura-chrome-mid)] font-light">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#4A7C59]" /> Cam kết bảo mật thông tin
            </span>
            <span>•</span>
            <span>Không gửi spam</span>
          </div>
        </div>
      </div>
    </section>
  );
}
