import React, { useState, useRef, useEffect } from 'react';
import { LandingNav } from '@/components/stitch/StitchLandingNew-nav';
import { LandingFooter } from '@/components/stitch/StitchLandingNew-footer';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { confirmedRecord, createSubmissionKey, submissionSession, useSubmissionSession } from '@/lib/server-confirmed-submission';
import { apiFetch } from '@/lib/api-client';
import {
  Coffee,
  CheckCircle2,
  Clock,
  Phone,
  MapPin,
  Sparkles,
  Send,
  User,
  Calendar,
  MessageSquare,
  Award,
  ChevronRight,
  ExternalLink,
  Briefcase,
  Smile,
} from 'lucide-react';

interface ApplicationData {
  fullName: string;
  phone: string;
  birthYear: string;
  position: 'barista' | 'service';
  shifts: string[];
  experience: 'none' | 'some' | 'experienced';
  note: string;
}

const INITIAL_FORM: ApplicationData = {
  fullName: '',
  phone: '',
  birthYear: '2004',
  position: 'barista',
  shifts: ['ca1', 'ca3_flexible'],
  experience: 'none',
  note: '',
};

export default function RecruitmentPage() {
  const session = useSubmissionSession();
  return <RecruitmentFormSession key={session} />;
}

function RecruitmentFormSession() {
  const requestKey = useRef(createSubmissionKey());
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [formData, setFormData] = useState<ApplicationData>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleShift = (shiftKey: string) => {
    setFormData((prev) => {
      const exists = prev.shifts.includes(shiftKey);
      if (exists) {
        if (prev.shifts.length <= 1) return prev; // Keep at least one
        return { ...prev, shifts: prev.shifts.filter((s) => s !== shiftKey) };
      }
      return { ...prev, shifts: [...prev.shifts, shiftKey] };
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inFlight.current) return;
    const session = submissionSession();
    const current = () => mounted.current && session === submissionSession();
    setErrorMessage(null);

    if (!formData.fullName.trim()) {
      setErrorMessage('Vui lòng nhập Họ và tên của bạn.');
      return;
    }
    if (!formData.phone.trim() || formData.phone.trim().length < 9) {
      setErrorMessage('Vui lòng nhập số điện thoại hoặc Zalo chính xác để Quản lý liên hệ.');
      return;
    }

    inFlight.current = true;
    setIsSubmitting(true);

    try {
      const payload = { ...formData, fullName: formData.fullName.trim(), phone: formData.phone.trim() };
      const response = await apiFetch('/api/recruitment/apply', {
        method: 'POST', body: JSON.stringify(payload), silent: true,
        headers: { 'Idempotency-Key': requestKey.current.forPayload(payload) },
      });
      confirmedRecord(response);
      if (!current()) return;
      requestKey.current.clear();
      setSubmitted(true);
    } catch (error) {
      if (current()) setErrorMessage(`Chưa xác nhận đã gửi hồ sơ. ${error instanceof Error ? error.message : 'Vui lòng kiểm tra kết nối.'} Vui lòng thử lại.`);
    } finally {
      if (current()) { inFlight.current = false; setIsSubmitting(false); }
    }
  };

  return (
    <div className="relative min-h-screen bg-[#050D1A] text-[#F0F4F8] selection:bg-[#EFBD8A] selection:text-[#050D1A]">
      <HelmetHead
        title="Ứng Tuyển Nhân Sự — AURA CAFE Sa Đéc"
        description="Gia nhập đội ngũ AURA CAFE tại 29 Nguyễn Tất Thành, Sa Đéc. Tuyển nhân viên Pha chế & Phục vụ thu ngân. Thu nhập 15k - 20k/giờ, ca làm linh hoạt."
        canonical="/tuyen-dung"
      />

      <LandingNav />

      <main className="pt-24 pb-20 px-4 md:px-8 max-w-5xl mx-auto">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto pt-6 pb-12">
          {/* Brand Header Plaque */}
          <div className="inline-flex items-center justify-center p-3 mb-6 bg-[#0E223D] border border-[#EFBD8A]/40 rounded-2xl shadow-xl shadow-black/40">
            <img
              src="/images/aura-master-logo.png"
              alt="AURA CAFE Master Logo"
              className="h-16 w-auto object-contain"
            />
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#112948] border border-[#2A4362] text-[#EFBD8A] text-xs font-bold tracking-widest uppercase mb-4">
            <MapPin className="w-3.5 h-3.5 text-[#EFBD8A]" />
            Container Rooftop • 29 Nguyễn Tất Thành, Sa Đéc
          </div>

          <h1 className="font-serif text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
            Gia Nhập Đội Ngũ <span className="text-[#EFBD8A]">AURA CAFE</span>
          </h1>

          <p className="text-[#A2B0C0] text-base md:text-lg font-light leading-relaxed max-w-2xl mx-auto">
            Không gian cà phê container phong cách Industrial Luxury đầu tiên tại Sa Đéc. Môi trường trẻ trung, cởi mở, chế độ đãi ngộ xứng đáng và ca làm linh hoạt theo lịch học.
          </p>
        </div>

        {/* 2 Vị Trí Tuyển Dụng */}
        <section aria-label="Các vị trí tuyển dụng" className="mb-14">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2.5">
              <span className="w-2 h-6 rounded bg-[#FFD700] inline-block" />
              Các Vị Trí Đang Tuyển Dụng
            </h2>
            <span className="text-xs uppercase tracking-wider text-[#EFBD8A] font-semibold bg-[#112948] px-3 py-1 rounded-full border border-[#2A4362]">
              Thu nhập 15k - 20k/giờ
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Barista */}
            <div className="bg-[#0E223D] border border-[#2A4362] rounded-2xl p-6 relative overflow-hidden shadow-lg hover:border-[#EFBD8A]/60 transition-all">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-[#FFE680] to-[#C9924A]" />
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#172B45] border border-[#EFBD8A]/30 flex items-center justify-center shrink-0">
                    <Coffee className="w-6 h-6 text-[#EFBD8A]" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#EFBD8A] tracking-wider uppercase block">Vị Trí 01</span>
                    <h3 className="text-lg font-extrabold text-white">NHÂN VIÊN PHA CHẾ (BARISTA)</h3>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#172B45] text-[#D4E3FF] border border-white/10 shrink-0">
                  Full-time / Part-time
                </span>
              </div>

              <div className="space-y-2.5 text-sm text-[#A2B0C0] mb-5 pl-2 border-l border-white/10">
                <p>• Pha chế cà phê máy espresso, trà trái cây signature, đá xay và các dòng đồ uống thủ công.</p>
                <p>• Kiểm soát định lượng, chất lượng thành phẩm và vệ sinh khu vực quầy bar luôn sạch sẽ.</p>
                <p>• <strong className="text-white">Yêu cầu:</strong> Đam mê cà phê, cẩn thận, sạch sẽ. <span className="text-[#EFBD8A]">Chưa có kinh nghiệm sẽ được đào tạo bài bản từ đầu!</span></p>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#A2B0C0] block">Mức thu nhập</span>
                  <span className="text-base font-extrabold text-[#FFD700]">15.000đ - 20.000đ/giờ</span>
                  <span className="text-xs text-[#D4E3FF] ml-1">+ Tips + Thưởng</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, position: 'barista' }));
                    document.getElementById('application-form')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-4 py-2 rounded-xl bg-[#EFBD8A] text-[#050D1A] font-bold text-xs uppercase tracking-wider hover:bg-[#FFD700] transition-colors flex items-center gap-1.5"
                >
                  Chọn Ứng Tuyển <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Card 2: Service & Cashier */}
            <div className="bg-[#0E223D] border border-[#2A4362] rounded-2xl p-6 relative overflow-hidden shadow-lg hover:border-[#EFBD8A]/60 transition-all">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-[#C9D6DF] to-[#8E9DA8]" />
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#172B45] border border-white/20 flex items-center justify-center shrink-0">
                    <Smile className="w-6 h-6 text-[#C9D6DF]" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#C9D6DF] tracking-wider uppercase block">Vị Trí 02</span>
                    <h3 className="text-lg font-extrabold text-white">PHỤC VỤ &amp; THU NGÂN</h3>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#172B45] text-[#D4E3FF] border border-white/10 shrink-0">
                  Xoay ca theo lịch học
                </span>
              </div>

              <div className="space-y-2.5 text-sm text-[#A2B0C0] mb-5 pl-2 border-l border-white/10">
                <p>• Chào đón khách hàng niềm nở, hướng dẫn chỗ ngồi tại các khu vực container và rooftop.</p>
                <p>• Nhận order qua máy POS/Tablet, bưng bê phục vụ đồ uống và giữ gìn bàn ghế gọn gàng.</p>
                <p>• <strong className="text-white">Yêu cầu:</strong> Nụ cười thân thiện, trung thực, nhanh nhẹn, tinh thần hiếu khách.</p>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#A2B0C0] block">Mức thu nhập</span>
                  <span className="text-base font-extrabold text-[#FFD700]">15.000đ - 20.000đ/giờ</span>
                  <span className="text-xs text-[#D4E3FF] ml-1">+ Tips chia đều</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, position: 'service' }));
                    document.getElementById('application-form')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-4 py-2 rounded-xl bg-[#C9D6DF] text-[#050D1A] font-bold text-xs uppercase tracking-wider hover:bg-white transition-colors flex items-center gap-1.5"
                >
                  Chọn Ứng Tuyển <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Quyền Lợi & Đãi Ngộ */}
        <section aria-label="Quyền lợi nhân sự" className="mb-14">
          <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2.5 mb-6">
            <span className="w-2 h-6 rounded bg-[#FFD700] inline-block" />
            Quyền Lợi &amp; Môi Trường Làm Việc Tại AURA
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#0B1D33] border border-[#233B57] rounded-xl p-4 text-center">
              <Clock className="w-7 h-7 text-[#EFBD8A] mx-auto mb-2" />
              <h4 className="font-bold text-sm text-white mb-1">Ca Làm Linh Hoạt</h4>
              <p className="text-xs text-[#A2B0C0]">Ca 1 (6:00-14:00), Ca 2 (14:00-22:00), Ca 3 Linh hoạt (Part-time). Đăng ký theo tuần.</p>
            </div>

            <div className="bg-[#0B1D33] border border-[#233B57] rounded-xl p-4 text-center">
              <Award className="w-7 h-7 text-[#FFD700] mx-auto mb-2" />
              <h4 className="font-bold text-sm text-white mb-1">Đãi Ngộ Xứng Đáng</h4>
              <p className="text-xs text-[#A2B0C0]">Lương trả đúng hẹn, tiền tip chia đều hàng tuần.</p>
            </div>

            <div className="bg-[#0B1D33] border border-[#233B57] rounded-xl p-4 text-center">
              <Coffee className="w-7 h-7 text-[#C9D6DF] mx-auto mb-2" />
              <h4 className="font-bold text-sm text-white mb-1">AURA VIP Privilege</h4>
              <p className="text-xs text-[#A2B0C0]">Ưu đãi menu cho nhân viên &amp; bạn bè, ưu tiên trải nghiệm các món đồ uống mới.</p>
            </div>

            <div className="bg-[#0B1D33] border border-[#233B57] rounded-xl p-4 text-center">
              <Sparkles className="w-7 h-7 text-[#EFBD8A] mx-auto mb-2" />
              <h4 className="font-bold text-sm text-white mb-1">Đào Tạo &amp; Lộ Trình</h4>
              <p className="text-xs text-[#A2B0C0]">Đào tạo nghề Barista &amp; kỹ năng dịch vụ, lộ trình thăng tiến rõ ràng.</p>
            </div>
          </div>
        </section>

        {/* Application Form Section */}
        <section id="application-form" aria-label="Form ứng tuyển" className="scroll-mt-28">
          <div className="bg-[#0E223D] border border-[#EFBD8A]/50 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
            {submitted ? (
              /* Success Screen */
              <div className="text-center py-10 max-w-lg mx-auto">
                <div className="w-20 h-20 rounded-full bg-[#172B45] border-2 border-[#EFBD8A] flex items-center justify-center mx-auto mb-6 shadow-xl">
                  <CheckCircle2 className="w-10 h-10 text-[#EFBD8A]" />
                </div>
                <h3 className="text-2xl md:text-3xl font-extrabold text-white mb-3">
                  Đã Tiếp Nhận Hồ Sơ Thành Công!
                </h3>
                <p className="text-[#D4E3FF] text-base mb-6 leading-relaxed">
                  Cảm ơn <strong className="text-white">{formData.fullName}</strong> đã quan tâm ứng tuyển vị trí{' '}
                  <strong className="text-[#FFD700]">
                    {formData.position === 'barista' ? 'Pha chế (Barista)' : 'Phục vụ & Thu ngân'}
                  </strong>.
                  Quản lý AURA CAFE sẽ liên hệ với bạn trong vòng 24 giờ qua số điện thoại{' '}
                  <strong className="text-white">{formData.phone}</strong>.
                </p>

                <div className="bg-[#112948] border border-[#2A4362] rounded-2xl p-5 mb-8 text-left space-y-3">
                  <div className="flex items-center gap-3 text-sm text-[#A2B0C0]">
                    <MapPin className="w-4 h-4 text-[#EFBD8A] shrink-0" />
                    <span>Địa chỉ quán: <strong>29 Nguyễn Tất Thành, TP. Sa Đéc, Đồng Tháp</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-[#A2B0C0]">
                    <Phone className="w-4 h-4 text-[#EFBD8A] shrink-0" />
                    <span>Hotline Tuyển dụng: <strong>0986.470.981</strong></span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a
                    href="https://zalo.me/0986470981"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3.5 rounded-xl bg-[#0068FF] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:bg-[#0055D4] transition-all"
                  >
                    <span>Nhắn Zalo Quản Lý Ngay</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  <a
                    href="tel:0986470981"
                    className="px-6 py-3.5 rounded-xl bg-[#172B45] text-white border border-[#EFBD8A]/60 font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#233B57] transition-all"
                  >
                    <Phone className="w-4 h-4 text-[#EFBD8A]" />
                    <span>Gọi Hotline 0986.470.981</span>
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setFormData(INITIAL_FORM);
                  }}
                  className="mt-6 text-xs text-[#A2B0C0] underline hover:text-white"
                >
                  Gửi một hồ sơ ứng tuyển khác
                </button>
              </div>
            ) : (
              /* Input Form */
              <div>
                <div className="border-b border-white/10 pb-6 mb-8">
                  <span className="text-xs uppercase tracking-widest text-[#EFBD8A] font-bold block mb-1">
                    Nộp Hồ Sơ Nhanh (60 Giây)
                  </span>
                  <h3 className="text-2xl md:text-3xl font-extrabold text-white">
                    Ứng Tuyển Trực Tuyến
                  </h3>
                  <p className="text-sm text-[#A2B0C0] mt-1">
                    Điền thông tin cơ bản bên dưới, chúng tôi sẽ xếp lịch hẹn phỏng vấn trực tiếp tại quán cho bạn.
                  </p>
                </div>

                {errorMessage && (
                  <div className="mb-6 p-4 rounded-xl bg-red-900/40 border border-red-500/50 text-red-200 text-sm">
                    {errorMessage}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Vị trí ứng tuyển */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#A2B0C0] mb-3">
                      1. VỊ TRÍ ỨNG TUYỂN <span className="text-[#FFD700]">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label
                        className={`cursor-pointer rounded-xl p-4 border flex items-center justify-between transition-all ${
                          formData.position === 'barista'
                            ? 'bg-[#172B45] border-[#EFBD8A] shadow-md'
                            : 'bg-[#0B1D33] border-[#233B57] hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="position"
                            value="barista"
                            checked={formData.position === 'barista'}
                            onChange={() => setFormData((prev) => ({ ...prev, position: 'barista' }))}
                            className="text-[#EFBD8A] focus:ring-[#EFBD8A]"
                          />
                          <div>
                            <span className="font-bold text-white block text-sm">Pha chế (Barista)</span>
                            <span className="text-xs text-[#FFD700]">15k - 20k/h + Thưởng</span>
                          </div>
                        </div>
                        <Coffee className="w-5 h-5 text-[#EFBD8A]" />
                      </label>

                      <label
                        className={`cursor-pointer rounded-xl p-4 border flex items-center justify-between transition-all ${
                          formData.position === 'service'
                            ? 'bg-[#172B45] border-[#EFBD8A] shadow-md'
                            : 'bg-[#0B1D33] border-[#233B57] hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="position"
                            value="service"
                            checked={formData.position === 'service'}
                            onChange={() => setFormData((prev) => ({ ...prev, position: 'service' }))}
                            className="text-[#EFBD8A] focus:ring-[#EFBD8A]"
                          />
                          <div>
                            <span className="font-bold text-white block text-sm">Phục vụ &amp; Thu ngân</span>
                            <span className="text-xs text-[#FFD700]">15k - 20k/h + Tips</span>
                          </div>
                        </div>
                        <Smile className="w-5 h-5 text-[#C9D6DF]" />
                      </label>
                    </div>
                  </div>

                  {/* Thông tin cá nhân: Họ tên, Số điện thoại, Năm sinh */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="fullName" className="block text-xs font-bold uppercase tracking-wider text-[#A2B0C0] mb-2">
                        Họ và Tên <span className="text-[#FFD700]">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-[#A2B0C0] absolute left-3.5 top-3.5" />
                        <input
                          id="fullName"
                          type="text"
                          required
                          value={formData.fullName}
                          onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                          placeholder="Ví dụ: Nguyễn Văn An"
                          className="w-full bg-[#0B1D33] border border-[#233B57] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-[#5E718D] focus:border-[#EFBD8A] focus:outline-none focus:ring-1 focus:ring-[#EFBD8A]"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-xs font-bold uppercase tracking-wider text-[#A2B0C0] mb-2">
                        Số điện thoại / Zalo <span className="text-[#FFD700]">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-[#A2B0C0] absolute left-3.5 top-3.5" />
                        <input
                          id="phone"
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                          placeholder="Ví dụ: 0912 345 678"
                          className="w-full bg-[#0B1D33] border border-[#233B57] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-[#5E718D] focus:border-[#EFBD8A] focus:outline-none focus:ring-1 focus:ring-[#EFBD8A]"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="birthYear" className="block text-xs font-bold uppercase tracking-wider text-[#A2B0C0] mb-2">
                        Năm sinh <span className="text-[#FFD700]">*</span>
                      </label>
                      <div className="relative">
                        <Calendar className="w-4 h-4 text-[#A2B0C0] absolute left-3.5 top-3.5" />
                        <select
                          id="birthYear"
                          value={formData.birthYear}
                          onChange={(e) => setFormData((prev) => ({ ...prev, birthYear: e.target.value }))}
                          className="w-full bg-[#0B1D33] border border-[#233B57] rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-[#EFBD8A] focus:outline-none focus:ring-1 focus:ring-[#EFBD8A]"
                        >
                          {Array.from({ length: 15 }, (_, i) => 2008 - i).map((year) => (
                            <option key={year} value={year} className="bg-[#0B1D33] text-white">
                              {year} ({2026 - year} tuổi)
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Ca làm việc mong muốn */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#A2B0C0] mb-2">
                      2. CA LÀM VIỆC CÓ THỂ ĐĂNG KÝ <span className="text-[#FFD700]">*</span> (chọn 1 hoặc nhiều)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { key: 'ca1', label: 'Ca 1', time: '6:00 - 14:00 (Sáng)' },
                        { key: 'ca2', label: 'Ca 2', time: '14:00 - 22:00 (Chiều tối)' },
                        { key: 'ca3_flexible', label: 'Ca 3', time: 'Linh hoạt (Part-time)' },
                      ].map((shift) => {
                        const selected = formData.shifts.includes(shift.key);
                        return (
                          <button
                            key={shift.key}
                            type="button"
                            onClick={() => toggleShift(shift.key)}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              selected
                                ? 'bg-[#172B45] border-[#EFBD8A] text-white'
                                : 'bg-[#0B1D33] border-[#233B57] text-[#A2B0C0] hover:border-white/20'
                            }`}
                          >
                            <span className="font-bold text-xs block">{shift.label}</span>
                            <span className="text-[11px] text-[#A2B0C0]">{shift.time}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Kinh nghiệm */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#A2B0C0] mb-2">
                      3. KINH NGHIỆM TRƯỚC ĐÂY (F&amp;B / Bán hàng)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { key: 'none', label: 'Chưa có kinh nghiệm (sẽ được đào tạo)' },
                        { key: 'some', label: 'Đã từng làm việc 1 - 3 tháng' },
                        { key: 'experienced', label: 'Kinh nghiệm trên 6 tháng' },
                      ].map((exp) => (
                        <label
                          key={exp.key}
                          className={`cursor-pointer p-3 rounded-xl border flex items-center gap-2.5 text-xs transition-all ${
                            formData.experience === exp.key
                              ? 'bg-[#172B45] border-[#EFBD8A] text-white font-semibold'
                              : 'bg-[#0B1D33] border-[#233B57] text-[#A2B0C0]'
                          }`}
                        >
                          <input
                            type="radio"
                            name="experience"
                            value={exp.key}
                            checked={formData.experience === exp.key}
                            onChange={() => setFormData((prev) => ({ ...prev, experience: exp.key as ApplicationData['experience'] }))}
                            className="text-[#EFBD8A] focus:ring-[#EFBD8A]"
                          />
                          <span>{exp.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Lời nhắn / Ghi chú */}
                  <div>
                    <label htmlFor="note" className="block text-xs font-bold uppercase tracking-wider text-[#A2B0C0] mb-2">
                      Lời Nhắn / Lịch Học Hoặc Câu Hỏi Thêm (tùy chọn)
                    </label>
                    <textarea
                      id="note"
                      rows={2}
                      value={formData.note}
                      onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                      placeholder="Ví dụ: Em đang học buổi sáng, có thể làm full ca chiều và tối..."
                      className="w-full bg-[#0B1D33] border border-[#233B57] rounded-xl p-3 text-sm text-white placeholder-[#5E718D] focus:border-[#EFBD8A] focus:outline-none focus:ring-1 focus:ring-[#EFBD8A]"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-4 rounded-xl bg-gradient-to-r from-[#FFE680] via-[#EFBD8A] to-[#C9924A] text-[#050D1A] font-extrabold text-base uppercase tracking-widest hover:brightness-110 active:scale-[0.99] transition-all shadow-xl shadow-[#EFBD8A]/10 flex items-center justify-center gap-2.5 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span>Đang gửi hồ sơ...</span>
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          <span>Gửi Đăng Ký Ứng Tuyển Ngay</span>
                        </>
                      )}
                    </button>
                    <p className="text-center text-[11px] text-[#A2B0C0] mt-3">
                      Hồ sơ của bạn được bảo mật và chuyển trực tiếp đến Ban Quản Lý AURA CAFE.
                    </p>
                  </div>
                </form>
              </div>
            )}
          </div>
        </section>

        {/* Contact Hotline & Location Banner */}
        <div className="mt-12 bg-[#0B1D33] border border-[#233B57] rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#172B45] border border-[#EFBD8A]/40 flex items-center justify-center shrink-0">
              <Phone className="w-6 h-6 text-[#EFBD8A]" />
            </div>
            <div>
              <span className="text-xs text-[#A2B0C0] block font-semibold uppercase tracking-wider">
                Cần Trao Đổi Trực Tiếp Với Quản Lý?
              </span>
              <a href="tel:0986470981" className="text-xl font-extrabold text-white hover:text-[#EFBD8A] transition-colors">
                Hotline / Zalo: 0986.470.981
              </a>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <a
              href="https://zalo.me/0986470981"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 md:flex-initial px-5 py-2.5 rounded-xl bg-[#0068FF] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-[#0055D4] transition-all"
            >
              <span>Nhắn Zalo</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href="tel:0986470981"
              className="flex-1 md:flex-initial px-5 py-2.5 rounded-xl bg-[#172B45] border border-white/20 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-white/10 transition-all"
            >
              <Phone className="w-3.5 h-3.5 text-[#EFBD8A]" />
              <span>Gọi Ngay</span>
            </a>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
