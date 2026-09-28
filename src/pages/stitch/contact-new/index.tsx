import { useState } from 'react';
import { LandingNav } from '@/components/stitch/StitchLandingNew-nav';
import { LandingFooter } from '@/components/stitch/StitchLandingNew-footer';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { MapPin, Phone, Mail, Clock, Send, CheckCircle2 } from 'lucide-react';

export default function ContactNew() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: '', contact: '', message: '' });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.name || !formData.contact) return;
    setSubmitted(true);
  };

  return (
    <div className="relative min-h-screen bg-[var(--aura-noir-deep,#0a1a2e)] text-[var(--aura-chrome-bright)] selection:bg-[var(--aura-chrome-mid)] selection:text-[#0A1A2E]">
      <HelmetHead
        title="Liên Hệ &amp; Vị Trí — AURA CAFE"
        description="Thông tin liên hệ, hotline, địa chỉ và bản đồ chỉ đường đến AURA CAFE tại 39 Nguyễn Tất Thành, Sa Đéc, Đồng Tháp."
        canonical="/contact"
      />
      {/* Top Navigation */}
      <LandingNav />

      <div role="region" aria-label="Liên Hệ" className="pt-24 min-h-screen">
        {/* Hero */}
        <section className="relative py-16 px-6 text-center overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto">
            <span className="text-[var(--aura-chrome-mid)] text-xs uppercase tracking-[0.3em] font-semibold block mb-3">
              AURA CAFE • SA ĐÉC, ĐỒNG THÁP
            </span>
            <h1 className="font-display text-4xl md:text-6xl text-white font-medium mb-4">
              Liên Hệ &amp; Kết Nối
            </h1>
            <p className="font-body text-base text-[var(--aura-chrome-soft)] font-light">
              Chúng tôi luôn sẵn sàng lắng nghe mọi ý kiến đóng góp, phản hồi hoặc yêu cầu đặt tiệc, sự kiện từ quý khách.
            </p>
          </div>
        </section>

        {/* Content Grid */}
        <div className="px-6 pb-20 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Contact Info */}
          <div className="md:col-span-5 bg-white/5 backdrop-blur-[12px] border border-white/10 rounded-[32px] p-8 flex flex-col justify-between gap-6 border-t border-[var(--aura-chrome-mid)]/40 shadow-xl">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--aura-chrome-mid)]/10 flex items-center justify-center shrink-0 border border-[var(--aura-chrome-mid)]/30">
                  <MapPin className="w-5 h-5 text-[var(--aura-chrome-bright)]" />
                </div>
                <div>
                  <h3 className="font-body text-xs font-bold uppercase tracking-widest text-[var(--aura-chrome-mid)] mb-1">ĐỊA CHỈ</h3>
                  <p className="font-body text-sm text-[var(--aura-chrome-bright)] leading-relaxed">
                    39 Nguyễn Tất Thành, Phường 1,<br />
                    TP. Sa Đéc, Đồng Tháp
                  </p>
                </div>
              </div>

              <div className="w-full h-px bg-white/10" />

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--aura-chrome-mid)]/10 flex items-center justify-center shrink-0 border border-[var(--aura-chrome-mid)]/30">
                  <Phone className="w-5 h-5 text-[var(--aura-chrome-bright)]" />
                </div>
                <div>
                  <h3 className="font-body text-xs font-bold uppercase tracking-widest text-[var(--aura-chrome-mid)] mb-1">HOTLINE ĐẶT BÀN &amp; GIAO HÀNG</h3>
                  <a href="tel:+84946013633" className="font-body text-base font-semibold text-[var(--aura-chrome-bright)] hover:underline">
                    +84 946 013 633
                  </a>
                </div>
              </div>

              <div className="w-full h-px bg-white/10" />

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--aura-chrome-mid)]/10 flex items-center justify-center shrink-0 border border-[var(--aura-chrome-mid)]/30">
                  <Clock className="w-5 h-5 text-[var(--aura-chrome-bright)]" />
                </div>
                <div>
                  <h3 className="font-body text-xs font-bold uppercase tracking-widest text-[var(--aura-chrome-mid)] mb-1">GIỜ PHỤC VỤ</h3>
                  <p className="font-body text-sm text-[var(--aura-chrome-bright)]">
                    06:00 — 23:00 (Mỗi ngày)
                  </p>
                </div>
              </div>

              <div className="w-full h-px bg-white/10" />

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--aura-chrome-mid)]/10 flex items-center justify-center shrink-0 border border-[var(--aura-chrome-mid)]/30">
                  <Mail className="w-5 h-5 text-[var(--aura-chrome-bright)]" />
                </div>
                <div>
                  <h3 className="font-body text-xs font-bold uppercase tracking-widest text-[var(--aura-chrome-mid)] mb-1">HỘP THƯ ĐIỆN TỬ</h3>
                  <a href="mailto:lienhe@auracafe.vn" className="font-body text-sm text-[var(--aura-chrome-bright)] hover:underline">
                    lienhe@auracafe.vn
                  </a>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <a
                href="https://maps.app.goo.gl/KMKbeDY4gM2FBBpw9"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-full border border-[var(--aura-chrome-mid)]/40 text-xs font-bold uppercase tracking-wider text-[var(--aura-chrome-bright)] hover:bg-[var(--aura-chrome-mid)]/10 transition-all"
              >
                <MapPin className="w-4 h-4" /> Mở Google Maps Chỉ Đường
              </a>
            </div>
          </div>

          {/* Form */}
          <div className="md:col-span-7 bg-white/5 backdrop-blur-[12px] border border-white/10 rounded-[32px] p-8 border-t border-[var(--aura-chrome-mid)]/40 shadow-xl flex flex-col justify-between">
            <div>
              <h2 className="font-display text-2xl text-white mb-2">Gửi Tin Nhắn Cho Chúng Tôi</h2>
              <p className="font-body text-xs text-[var(--aura-chrome-mid)] mb-6">
                Đội ngũ AURA CAFE sẽ phản hồi quý khách trong thời gian sớm nhất.
              </p>

              {submitted ? (
                <div className="py-12 flex flex-col items-center text-center space-y-4">
                  <CheckCircle2 className="w-16 h-16 text-[#4A7C59]" />
                  <h3 className="font-display text-xl text-white">Gửi Thành Công!</h3>
                  <p className="font-body text-sm text-[var(--aura-chrome-mid)] max-w-sm">
                    Cảm ơn quý khách đã gửi tin nhắn. Đội ngũ AURA CAFE sẽ liên hệ lại với quý khách sớm nhất.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setSubmitted(false); setFormData({ name: '', contact: '', message: '' }); }}
                    className="mt-4 px-6 py-2 rounded-full border border-[var(--aura-chrome-mid)] text-xs uppercase tracking-wider"
                  >
                    Gửi tin nhắn khác
                  </button>
                </div>
              ) : (
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div>
                    <label className="font-body text-xs font-bold tracking-wider text-[var(--aura-chrome-mid)] block mb-1" htmlFor="name">
                      HỌ VÀ TÊN *
                    </label>
                    <input
                      id="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-[var(--aura-chrome-mid)]/50 focus:border-[var(--aura-chrome-bright)] focus:outline-none transition-all"
                      placeholder="Ví dụ: Nguyễn Văn A"
                      type="text"
                    />
                  </div>

                  <div>
                    <label className="font-body text-xs font-bold tracking-wider text-[var(--aura-chrome-mid)] block mb-1" htmlFor="contact">
                      SỐ ĐIỆN THOẠI HOẶC EMAIL *
                    </label>
                    <input
                      id="contact"
                      required
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-[var(--aura-chrome-mid)]/50 focus:border-[var(--aura-chrome-bright)] focus:outline-none transition-all"
                      placeholder="Ví dụ: 0946 013 633 hoặc email@example.com"
                      type="text"
                    />
                  </div>

                  <div>
                    <label className="font-body text-xs font-bold tracking-wider text-[var(--aura-chrome-mid)] block mb-1" htmlFor="message">
                      NỘI DUNG TIN NHẮN / GÓP Ý *
                    </label>
                    <textarea
                      id="message"
                      required
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-[var(--aura-chrome-mid)]/50 focus:border-[var(--aura-chrome-bright)] focus:outline-none transition-all resize-none"
                      placeholder="Nhập nội dung chia sẻ hoặc thắc mắc của bạn..."
                      rows={4}
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[var(--aura-chrome-bright)] hover:bg-white text-[var(--aura-noir-deep)] py-3.5 px-6 rounded-xl font-body text-xs font-bold uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2 group cursor-pointer shadow-lg active:scale-[0.99]"
                  >
                    <span>Gửi Tin Nhắn</span>
                    <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
