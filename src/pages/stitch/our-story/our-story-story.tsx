import { Boxes, Coffee, Sparkles, Compass } from 'lucide-react';

export function StorySection() {
  return (
    <section className="py-32 px-5 md:px-16 max-w-[1280px] mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Header */}
        <div className="md:col-span-12 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--aura-chrome-mid)]/10 border border-[var(--aura-chrome-mid)]/20 mb-4">
            <Compass className="w-4 h-4 text-[var(--aura-chrome-bright)]" />
            <span className="text-[var(--aura-chrome-mid)] text-xs uppercase tracking-widest font-body font-semibold">Tuyên Ngôn Thiết Kế</span>
          </div>
          <h2 className="font-display text-3xl md:text-5xl text-[var(--aura-chrome-bright)] mb-4">
            Bản Thiết Kế Độc Bản
          </h2>
          <div className="text-[var(--aura-chrome-mid)] max-w-2xl font-body font-light leading-relaxed">
            AURA CAFE không chỉ là một điểm hẹn cà phê; đó là sự giao thoa hài hòa giữa kiến trúc container công nghiệp mạnh mẽ và không gian xanh thoáng đãng giữa lòng thành phố hoa Sa Đéc.
          </div>
        </div>

        {/* Architectural Salvage (md:col-span-7) */}
        <div className="md:col-span-7 bg-white/5 backdrop-blur-[8px] border border-white/10 rounded-[40px] p-10 md:p-12 border-t border-[var(--aura-chrome-mid)]/40 flex flex-col justify-between group hover:border-[var(--aura-chrome-bright)]/40 transition-all duration-500 shadow-2xl">
          <div>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-[var(--aura-chrome-mid)]/15 border border-[var(--aura-chrome-mid)]/30 flex items-center justify-center text-[var(--aura-chrome-bright)]">
                <Boxes className="w-6 h-6" />
              </div>
              <span className="text-[var(--aura-chrome-bright)] font-bold tracking-widest font-body text-xs uppercase">
                KHÔNG GIAN: 01
              </span>
            </div>
            <h3 className="font-display text-xl md:text-3xl text-white mb-6 font-medium">
              Kiến Trúc Container Tái Sinh
            </h3>
            <div className="text-[var(--aura-chrome-mid)] leading-relaxed font-body font-light">
              Nền tảng của quán được dựng từ 3 khối container hàng hải kiên cố, quy hoạch thành 5 không gian trải nghiệm mở ngập tràn ánh sáng với vách kính cường lực trong suốt. Chúng tôi lưu giữ nét mộc mạc của kết cấu thép, đồng thời phủ xanh bằng hệ cây cảnh làng hoa tạo nên sự cân bằng phong thủy Thủy — Mộc.
            </div>
          </div>
          <div className="mt-12 h-64 overflow-hidden rounded-2xl border border-white/10 relative">
            <img
              className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
              alt="Góc kiến trúc container độc bản kết hợp kính và thép tại AURA CAFE Sa Đéc."
              src="/photos/IMG_6696.webp"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-noir-void)]/80 via-transparent to-transparent pointer-events-none" />
          </div>
        </div>

        {/* Right Column (md:col-span-5) */}
        <div className="md:col-span-5 flex flex-col gap-6">
          <div className="bg-white/5 backdrop-blur-[8px] border border-white/10 rounded-[40px] p-8 md:p-10 border-t border-[var(--aura-chrome-mid)]/40 h-full group hover:border-[var(--aura-chrome-bright)]/40 transition-all duration-500 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-[var(--aura-chrome-mid)]/15 border border-[var(--aura-chrome-mid)]/30 flex items-center justify-center text-[var(--aura-chrome-bright)] mb-6">
              <Coffee className="w-6 h-6" />
            </div>
            <h3 className="font-display text-lg md:text-2xl text-white mb-4 font-medium">Hương Vị Nguyên Bản</h3>
            <div className="text-[var(--aura-chrome-mid)] text-sm leading-relaxed font-body font-light">
              Mỗi tách cà phê đều được chắt chiu từ nguồn nông sản chất lượng cao của Việt Nam. Dù là ly cà phê phin đậm đà truyền thống hay espresso hiện đại, chúng tôi luôn giữ trọn vị mộc thuần khiết và hậu vị ngọt sâu.
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-[8px] border border-white/10 rounded-[40px] p-8 md:p-10 border-t border-[var(--aura-chrome-mid)]/40 h-full group hover:border-[var(--aura-chrome-bright)]/40 transition-all duration-500 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-[var(--aura-chrome-mid)]/15 border border-[var(--aura-chrome-mid)]/30 flex items-center justify-center text-[var(--aura-chrome-bright)] mb-6">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-display text-lg md:text-2xl text-white mb-4 font-medium">
              Điểm Hẹn Đa Trải Nghiệm
            </h3>
            <div className="text-[var(--aura-chrome-mid)] text-sm leading-relaxed font-body font-light">
              Không gian được phân chia linh hoạt: từ quầy bar sôi động, góc ghế mây thoáng gió chuyện trò, phòng container mát lạnh cho người làm việc, đến sân thượng ngắm trọn hoàng hôn và gió trời Sa Đéc.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
