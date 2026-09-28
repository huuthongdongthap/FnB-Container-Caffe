import { Award, Layers, HeartHandshake } from 'lucide-react';

export function ValuesSection() {
  return (
    <section className="py-32 px-5 md:px-16 max-w-[1280px] mx-auto overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Value 1: Quality */}
        <div className="bg-white/5 backdrop-blur-[8px] border border-white/10 rounded-[40px] p-10 md:p-12 flex flex-col items-center text-center group hover:border-[var(--aura-chrome-bright)]/40 transition-all duration-500 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-[var(--aura-chrome-mid)]/15 border border-[var(--aura-chrome-mid)]/30 flex items-center justify-center mb-8 group-hover:border-[var(--aura-chrome-bright)] text-[var(--aura-chrome-bright)] transition-colors duration-500">
            <Award className="w-8 h-8" />
          </div>
          <h3 className="font-display text-lg md:text-xl text-white mb-4 uppercase tracking-wider font-semibold">
            Chất Lượng Tinh Tuyển
          </h3>
          <div className="text-[var(--aura-chrome-mid)] text-sm font-body font-light leading-relaxed">
            Chúng tôi chọn lọc từng hạt cà phê Robusta và Arabica nguyên chất, kết hợp nguồn nông sản trái cây tươi ngon, đảm bảo mỗi ly đồ uống luôn trọn vẹn hương vị và an toàn sức khỏe.
          </div>
        </div>

        {/* Value 2: Space */}
        <div className="bg-white/5 backdrop-blur-[8px] border border-white/10 rounded-[40px] p-10 md:p-12 flex flex-col items-center text-center group relative overflow-hidden hover:border-[var(--aura-chrome-bright)]/40 transition-all duration-500 shadow-xl">
          <div className="absolute inset-0 bg-[var(--aura-chrome-bright)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="w-16 h-16 rounded-2xl bg-[var(--aura-chrome-mid)]/15 border border-[var(--aura-chrome-mid)]/30 flex items-center justify-center mb-8 group-hover:border-[var(--aura-chrome-bright)] text-[var(--aura-chrome-bright)] transition-colors duration-500">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="font-display text-lg md:text-xl text-white mb-4 uppercase tracking-wider font-semibold">
            Không Gian Độc Bản
          </h3>
          <div className="text-[var(--aura-chrome-mid)] text-sm font-body font-light leading-relaxed">
            3 khối container được quy hoạch thành 5 không gian trải nghiệm thông minh với vách kính lớn mở ra sân vườn xanh mát, mang đến trải nghiệm thư thái, mát mẻ cả ngày và rực rỡ ánh đèn về đêm.
          </div>
        </div>

        {/* Value 3: Dedication */}
        <div className="bg-white/5 backdrop-blur-[8px] border border-white/10 rounded-[40px] p-10 md:p-12 flex flex-col items-center text-center group hover:border-[var(--aura-chrome-bright)]/40 transition-all duration-500 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-[var(--aura-chrome-mid)]/15 border border-[var(--aura-chrome-mid)]/30 flex items-center justify-center mb-8 group-hover:border-[var(--aura-chrome-bright)] text-[var(--aura-chrome-bright)] transition-colors duration-500">
            <HeartHandshake className="w-8 h-8" />
          </div>
          <h3 className="font-display text-lg md:text-xl text-white mb-4 uppercase tracking-wider font-semibold">
            Phục Vụ Tận Tâm
          </h3>
          <div className="text-[var(--aura-chrome-mid)] text-sm font-body font-light leading-relaxed">
            Sự hiếu khách, nồng hậu của người miền Tây sông nước kết hợp tiện ích gọi món QR hiện đại mang lại sự thuận tiện và nụ cười hài lòng cho từng vị khách.
          </div>
        </div>
      </div>
    </section>
  );
}
