import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';

export function BrandVoiceSection() {
 const { t } = useTranslation();

 const BRAND_RULES_DO = [
  t('brand.rules.do1', 'Sử dụng ngôn từ ấm áp, gần gũi, mộc mạc chuẩn miền Tây.'),
  t('brand.rules.do2', 'Ưu tiên hình ảnh thực tế tại quán với ánh sáng tự nhiên hoặc ánh đèn vàng ấm.'),
  t('brand.rules.do3', 'Giữ nguyên tỷ lệ logo gốc, không cắt tròn và đảm bảo khoảng trống an toàn.'),
  t('brand.rules.do4', 'Đảm bảo độ tương phản văn bản đạt chuẩn WCAG AA trên nền tối (#0E1322).'),
  t('brand.rules.do5', 'Nhấn mạnh trải nghiệm không gian container tái chế xanh và bền vững.'),
 ];

 const BRAND_RULES_DONT = [
  t('brand.rules.dont1', 'Không dùng từ ngữ sáo rỗng, khoa trương hoặc xa cách với khách hàng địa phương.'),
  t('brand.rules.dont2', 'Không biến dạng, đổi màu tùy tiện hoặc cắt tròn biểu tượng thương hiệu.'),
  t('brand.rules.dont3', 'Không sử dụng chữ tối màu (-600 trở lên) trực tiếp trên nền tối.'),
  t('brand.rules.dont4', 'Không lạm dụng quá nhiều phông chữ ngoài bộ Be Vietnam Pro và JetBrains Mono.'),
  t('brand.rules.dont5', 'Không sử dụng hình ảnh stock thiếu chân thực hoặc sai lệch phong cách quán.'),
 ];

 return (
  <section className="mb-16 scroll-mt-20" id="brand-voice">
   <div className="mb-8">
    <h2 className="font-display text-2xl font-bold text-[color:var(--aura-chrome-bright)]">
     Brand Voice &amp; Rules
    </h2>
    <p className="mt-2 text-[color:var(--aura-chrome-bright)]">
     {t('brand.voice.description', 'Giọng điệu thương hiệu AURA CAFE mộc mạc, chân thành và hiếu khách — kết nối nhịp sống hiện đại với hơi thở yên bình của vùng đất hoa Sa Đéc.')}
    </p>
   </div>

   <div className="grid gap-6 md:grid-cols-2">
    <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6">
     <h3 className="font-display text-lg font-semibold text-green-400">{t('brand.voice.doTitle', "NÊN LÀM (DO'S)")}</h3>
     <ul className="mt-3 space-y-2">
      {BRAND_RULES_DO.map((rule) => (
       <li key={rule} className="flex items-start gap-2 text-sm text-[color:var(--aura-chrome-bright)]">
        <span className="mt-0.5 shrink-0 text-green-400" aria-hidden="true"><Check size={16} className="inline text-green-400" /></span>
        {rule}
       </li>
      ))}
     </ul>
    </div>
    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6">
     <h3 className="font-display text-lg font-semibold text-red-400">{t('brand.voice.dontTitle', "KHÔNG NÊN (DON'TS)")}</h3>
     <ul className="mt-3 space-y-2">
      {BRAND_RULES_DONT.map((rule) => (
       <li key={rule} className="flex items-start gap-2 text-sm text-[color:var(--aura-chrome-bright)]">
        <span className="mt-0.5 shrink-0 text-red-400" aria-hidden="true"><X size={16} className="inline text-red-400" /></span>
        {rule}
       </li>
      ))}
     </ul>
    </div>
   </div>

   <div className="mt-6 rounded-2xl border border-white/[0.1] bg-[color:var(--aura-surface-container)]/5 p-6 text-center">
    <p className="font-display text-xl font-semibold text-[color:var(--aura-chrome-bright)]">
     {t('brand.voice.slogan', 'Mộc mạc từ chất thép, ấm áp từ tâm giao')}
    </p>
    <p className="mt-1 text-sm text-[color:var(--aura-chrome-bright)]">
     {t('brand.voice.subSlogan', 'AURA CAFE — Không gian cà phê container giữa lòng Sa Đéc')}
    </p>
   </div>
  </section>
 );
}
