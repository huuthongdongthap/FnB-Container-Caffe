import { useTranslation } from 'react-i18next';

export function MaterialsSection() {
 const { t } = useTranslation();

 const MATERIALS = [
  { name: 'Corten Steel', desc: t('brand.materials.cortenSteelDesc', 'Bề mặt thép container nguyên bản với sắc rỉ sét tự nhiên, biểu trưng cho sự bền bỉ và cá tính công nghiệp.'), spec: 'Finish: weathered natural' },
  { name: 'Walnut Oak Wood', desc: t('brand.materials.walnutOakDesc', 'Gỗ tự nhiên vân ấm giúp cân bằng sự lạnh lẽo của kim loại, mang lại cảm giác gần gũi và thư thái.'), spec: 'Oil: Osmo Polyx' },
  { name: 'Smoked Brass', desc: t('brand.materials.smokedBrassDesc', 'Chi tiết đồng xước ánh kim tạo điểm nhấn tinh tế cho quầy pha chế và hệ thống đèn trang trí.'), spec: 'Finish: antique smoked' },
  { name: 'Black Terrazzo', desc: t('brand.materials.blackTerrazzoDesc', 'Đá mài terrazzo tối màu chống bám bẩn, bền vững và hài hòa với bảng màu Midnight Navy.'), spec: 'Size: 600x600mm' },
 ];

 return (
  <section className="mb-16 scroll-mt-20" id="materials">
   <div className="mb-8">
    <h2 className="font-display text-2xl font-bold text-[color:var(--aura-chrome-bright)]">
     Materials &amp; Texture
    </h2>
    <p className="mt-2 text-[color:var(--aura-chrome-bright)]">
     {t('brand.materials.description', 'Sự kết hợp hài hòa giữa vật liệu công nghiệp tái chế và chất liệu tự nhiên ấm áp tạo nên bản sắc không gian độc bản của AURA CAFE.')}
    </p>
   </div>

   <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {MATERIALS.map((material) => (
     <div key={material.name} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl p-6">
      <h3 className="font-display text-lg font-semibold text-[color:var(--aura-chrome-bright)]">{material.name}</h3>
      <p className="mt-2 text-sm text-[color:var(--aura-chrome-bright)]">{material.desc}</p>
      <p className="mt-3 text-xs text-[color:var(--aura-chrome-bright)]">{material.spec}</p>
     </div>
    ))}
   </div>
  </section>
 );
}
