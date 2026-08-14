import { useTranslation } from 'react-i18next';

interface GallerySectionProps {
  galleryMainUrl: string;
  galleryInsetUrl: string;
}

/** Gallery section showcasing AURA Cafe's industrial-luxury architecture. */
export function GallerySection({ galleryMainUrl, galleryInsetUrl }: GallerySectionProps) {
  const { t } = useTranslation();

  return (
    <section
      className="relative z-10 px-16 py-24"
      style={{ backgroundColor: 'color-mix(in srgb, var(--aura-bg-page) 50%, transparent)' }}
    >
      <div className="flex flex-col md:flex-row gap-20 items-center">
        {/* Gallery images */}
        <div className="w-full md:w-1/2 relative">
          <div
            className="p-2"
            style={{
              background: 'rgba(148, 163, 184, 0.1)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 0 20px color-mix(in srgb, var(--aura-chrome-bright) 15%, transparent)',
            }}
            data-glass-panel
          >
            <div
              className="w-full h-[500px] bg-cover bg-center"
              style={{ backgroundImage: `url('${galleryMainUrl}')` }}
              role="img"
              aria-label={t(
                'landing.galleryMainAlt',
                'A professional interior photograph of a shipping container cafe at night with warm amber lighting',
              )}
            />
          </div>
          <div
            className="absolute -bottom-10 -right-10 w-48 h-48 hidden md:block p-4"
            style={{
              background: 'rgba(148, 163, 184, 0.1)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderTop: '1px solid color-mix(in srgb, var(--aura-chrome-bright) 20%, transparent)',
            }}
            data-glass-panel
          >
            <div
              className="w-full h-full bg-cover bg-center"
              style={{ backgroundImage: `url('${galleryInsetUrl}')` }}
              role="img"
              aria-label={t(
                'landing.galleryInsetAlt',
                'A close-up shot of a perfectly crafted latte with intricate leaf art',
              )}
            />
          </div>
        </div>

        {/* Text content + bullet points */}
        <div className="w-full md:w-1/2">
          <span
            className="mb-4 block tracking-[0.4em] uppercase"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '12px',
              lineHeight: '1',
              fontWeight: 600,
              color: 'var(--aura-chrome-bright)',
            }}
          >
            {t('landing.gallerySubtitle', 'Kiến Trúc Độc Bản')}
          </span>
          <h2
            className="mb-8"
            style={{
              fontFamily: "'EB Garamond', serif",
              fontSize: '48px',
              lineHeight: '1.2',
              letterSpacing: '-0.01em',
              fontWeight: 500,
              color: 'var(--aura-chrome-bright)',
            }}
          >
            {t('landing.galleryTitle', 'Nổi Công Nghiệp Gặp Gủ Sự Sang Trọng')}
          </h2>
          <p
            className="mb-10 leading-relaxed"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '18px',
              lineHeight: '1.6',
              fontWeight: 400,
              color: 'var(--aura-chrome-soft)',
            }}
          >
            {t(
              'landing.galleryDescription',
              'Aura Cafe không chỉ là một quán cà phê; đó là một từ nguyên về phong cách sống. Những khối container thô cứng được chúng tôi biến đổi thành không gian nghệ thuật với vật liệu cao cấp, ánh sáng thông minh và tâm hôn của những người yêu cái đẹp.',
            )}
          </p>
          <div className="space-y-6">
            <GalleryBullet
              titleKey="landing.galleryBullet1Title"
              titleFallback="Vật liệu tinh tuyển"
              descKey="landing.galleryBullet1Desc"
              descFallback="Sự kết hợp giữa thép không gì, kính cường lực mô và gỗ sối tự nhiên."
              t={t}
            />
            <GalleryBullet
              titleKey="landing.galleryBullet2Title"
              titleFallback="Ánh sáng cảm xúc"
              descKey="landing.galleryBullet2Desc"
              descFallback="Hệ thống chiếu sáng được thiết kế bởi chuyên gia, tối ưu cho trải nghiệm buổi tối."
              t={t}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

interface GalleryBulletProps {
  titleKey: string;
  titleFallback: string;
  descKey: string;
  descFallback: string;
  t: (key: string, fallback: string) => string;
}

/** Single bullet point row in the gallery section. */
function GalleryBullet({ titleKey, titleFallback, descKey, descFallback, t }: GalleryBulletProps) {
  return (
    <div className="flex items-start gap-4">
      <div
        className="mt-1 w-2 h-2 shrink-0"
        style={{ backgroundColor: 'var(--aura-chrome-bright)', borderRadius: 0 }}
        aria-hidden="true"
      />
      <div>
        <h4
          className="mb-1 uppercase"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '12px',
            lineHeight: '1',
            fontWeight: 600,
            letterSpacing: '0.1em',
            color: 'var(--aura-chrome-bright)',
          }}
        >
          {t(titleKey, titleFallback)}
        </h4>
        <p
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '14px',
            lineHeight: '1.5',
            fontWeight: 400,
            color: 'var(--aura-chrome-soft)',
          }}
        >
          {t(descKey, descFallback)}
        </p>
      </div>
    </div>
  );
}
