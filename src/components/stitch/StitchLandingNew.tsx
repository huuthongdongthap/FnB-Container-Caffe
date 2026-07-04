import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  ChevronRight,
  Coffee,
  ArmchairIcon as Seat,
  Truck,
  MapPin,
  Clock,
  Phone,
} from 'lucide-react';

export interface StitchLandingNewProps {
  heroBgUrl?: string;
  galleryMainUrl?: string;
  galleryInsetUrl?: string;
  locationMapUrl?: string;
}

const defaultHeroBgUrl =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA1OAFHunc-YO5r8iyjCW7TTf2MK-XdcgutPX_eey8ghAWImW0S6KKn_Z1dnR85Ak_jtnYcmOEBEgZOHmuafZnsfAufwSV2hYixBwFiizwwQyLsvy_8FmfTcP-JzUup1oY2B65sFUEf9Q1WOq_8JIVzcqsCfrU3kGmPb09M5ILa923u1sVvlQ3Nh256Oh_lUA6R15iJWP7VN5ktYR1-bfkT2DCJ7iAlvcn6XXxIAHosilS66Agqd4OBMg7hItzEatmu_n6WsQJ2EJs';

const defaultGalleryMainUrl =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAgug0PtrpcGPyiHsuxHnYB-yOrihQNAacf46Eh6qLSxFEzi9GW1TD1dodoVMPupKxcOlz7R8B3IMA0PS-fnOJlmnhWqD3vzZoxP6U4BPbf27qnrapBnJNnIMQmhDyNdyqd6UytVcpluJ85os_IkFvxTkLon2uUzBXDKJ_eVLbUjjUH10893ZJ9zfgBX2_0AsynA48IKa7teB1MYi3oEerHz323MeDeeU3rNWcMJGW3UxBrQLcF7M5HxV24Z5xX_7shRjYD9b2f0kk';

const defaultGalleryInsetUrl =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDnWwO-DRD9DD29TBd45cZMMkK9yQuQT0zqAhpg_bkHWkVrfJreFSFuhI6gZoq3cRwh1amiDpZpg7zBw07sr6R0oh-7wTYRv36GOUVrP7KHMplhjkuFK7FOD7cUcmlmTU6txaMh_lHRlNqZsa0xkk7vYPK-2g4wdW8y_1R3oioJKO-Wr3tGAtoQ96QzBsINHbSn7l922bmUPM6bMIk7hnW8CQ-FMEy2KLGZmJ3Z0evzve3HUPsZR_HxxCV52YdiwtumoTEFH9QknwI';

const defaultLocationMapUrl =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCCC8e6-10nBjxjAWVGqXQFsManel1ya-0792nwZj4jeemPqnXloh1hrpArWYh1IM0fv1RSwfl0HET7jRGprsBlWnnZHY3b36EBq5SiRFFvS4NPRdM5PjOT_3MCboTSOk97YT1Itp8kK8hDeYbEsXkI-mFWSEiccQXEoHSMNArH0ObyTa-wGvJAIVugGCFd4bdgk6SxdRZ5cHZgbuOpAJMsKUbVprqwGgz52nM-fv4C2zn5HcVlodbeD6fVZb48EGD1CDcv8bHTR08';

export function StitchLandingNew({
  heroBgUrl = defaultHeroBgUrl,
  galleryMainUrl = defaultGalleryMainUrl,
  galleryInsetUrl = defaultGalleryInsetUrl,
  locationMapUrl = defaultLocationMapUrl,
}: Readonly<StitchLandingNewProps>) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const glassPanels = containerRef.current?.querySelectorAll('[data-glass-panel]');
      if (!glassPanels) return;
      glassPanels.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        if (
          localX > -100 &&
          localX < rect.width + 100 &&
          localY > -100 &&
          localY < rect.height + 100
        ) {
          (el as HTMLElement).style.borderImage = `radial-gradient(circle at ${localX}px ${localY}px, color-mix(in srgb, var(--st-secondary) 40%, transparent) 0%, transparent 100%) 1`;
        }
      });
    };
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen overflow-x-hidden"
      style={{
        backgroundColor: 'var(--st-surface-dim)',
        color: 'var(--st-on-surface)',
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      {/* Top Navigation Bar */}
      <nav
        className="fixed top-0 w-full z-50 flex justify-between items-center px-16 py-4 backdrop-blur-xl border-b border-[var(--st-outline-variant)]/30"
        style={{ backgroundColor: 'color-mix(in srgb, var(--st-surface-dim) 15%, transparent)' }}
      >
        <div
          className="tracking-tight"
          style={{
            fontFamily: "'EB Garamond', serif",
            fontSize: '32px',
            lineHeight: '1.3',
            fontWeight: 500,
            color: 'var(--st-on-surface)',
          }}
        >
          AURA CAFE
        </div>
        <div className="hidden md:flex items-center gap-10">
          <a
            href="/menu"
            className="border-b-2 pb-1"
            style={{
              fontFamily: "'EB Garamond', serif",
              fontSize: '24px',
              lineHeight: '1.4',
              fontWeight: 600,
              color: 'var(--st-secondary)',
              borderColor: 'var(--st-secondary)',
            }}
          >
            {t('nav.menu', 'Menu')}
          </a>
          <a
            href="/table-reservation"
            className="transition-colors"
            style={{
              fontFamily: "'EB Garamond', serif",
              fontSize: '24px',
              lineHeight: '1.4',
              fontWeight: 600,
              color: 'var(--st-on-surface-variant)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--st-on-surface)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--st-on-surface-variant)'; }}
          >
            {t('landing.reservation', 'Reservation')}
          </a>
          <a
            href="/about"
            className="transition-colors"
            style={{
              fontFamily: "'EB Garamond', serif",
              fontSize: '24px',
              lineHeight: '1.4',
              fontWeight: 600,
              color: 'var(--st-on-surface-variant)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--st-on-surface)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--st-on-surface-variant)'; }}
          >
            {t('landing.location', 'Location')}
          </a>
          <a
            href="/about"
            className="transition-colors"
            style={{
              fontFamily: "'EB Garamond', serif",
              fontSize: '24px',
              lineHeight: '1.4',
              fontWeight: 600,
              color: 'var(--st-on-surface-variant)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--st-on-surface)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--st-on-surface-variant)'; }}
          >
            {t('landing.about', 'About')}
          </a>
        </div>
        <button
          className="px-6 py-2 active:opacity-80 active:scale-95 transition-all duration-300"
          style={{
            backgroundColor: 'var(--st-secondary)',
            color: 'var(--st-on-secondary)',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '12px',
            lineHeight: '1',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {t('landing.orderNow', 'Order Now')}
        </button>
      </nav>

      {/* Main Content Canvas */}
      <main className="relative pt-24 min-h-screen">
        {/* Background Decorative Elements */}
        <div
          className="absolute inset-0 z-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(90deg, rgba(30, 41, 59, 0.5) 1px, transparent 1px)',
            backgroundSize: '80px 100%',
          }}
          aria-hidden="true"
        />
        <div
          className="absolute top-1/4 -right-24 w-96 h-96 rounded-full blur-[120px] pointer-events-none"
          style={{ backgroundColor: 'color-mix(in srgb, var(--st-secondary) 10%, transparent)' }}
          aria-hidden="true"
        />
        <div
          className="absolute bottom-1/4 -left-24 w-96 h-96 rounded-full blur-[120px] pointer-events-none"
          style={{ backgroundColor: 'color-mix(in srgb, var(--st-primary) 10%, transparent)' }}
          aria-hidden="true"
        />

        {/* Hero Section */}
        <section className="relative z-10 px-16 py-20 flex flex-col items-center justify-center min-h-[870px] text-center">
          <div
            className="p-12 md:p-24 max-w-5xl w-full relative overflow-hidden"
            style={{
              background: 'rgba(148, 163, 184, 0.1)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderTop: '1px solid color-mix(in srgb, var(--st-outline) 30%, transparent)',
            }}
            data-glass-panel
          >
            {/* Background Image Placeholder for Hero Context */}
            <div className="absolute inset-0 opacity-40 z-0" aria-hidden="true">
              <div
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url('${heroBgUrl}')` }}
              />
            </div>
            <div className="relative z-10 flex flex-col items-center">
              <span
                className="mb-6 tracking-[0.4em] uppercase"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '12px',
                  lineHeight: '1',
                  fontWeight: 600,
                  color: 'var(--st-secondary)',
                }}
              >
                {t('landing.heroTagline', 'Sa Dec • Premium Coffee')}
              </span>
              <h1
                className="mb-8 max-w-3xl"
                style={{
                  fontFamily: "'EB Garamond', serif",
                  fontSize: '64px',
                  lineHeight: '1.1',
                  letterSpacing: '-0.02em',
                  fontWeight: 500,
                  color: 'var(--st-on-surface)',
                }}
              >
                {t('landing.heroTitle', 'AURA CAFE')}
              </h1>
              <p
                className="max-w-2xl mb-12"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '18px',
                  lineHeight: '1.6',
                  fontWeight: 400,
                  color: 'var(--st-on-surface-variant)',
                }}
              >
                {t(
                  'landing.heroDescription',
                  'Trải nghiệm cà phê container thượng hạng giữa không gian công nghiệp sang trọng. Nơi ánh sáng và bóng tối hòa quyện tạo nên bản giao hưởng kiến trúc độc bản.',
                )}
              </p>
              <div className="flex flex-col sm:flex-row gap-6">
                <button
                  className="px-10 py-5 transition-all duration-500 uppercase flex items-center gap-3"
                  style={{
                    background: 'linear-gradient(135deg, var(--st-secondary) 0%, #B48554 100%)',
                    color: '#0c1c30',
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '12px',
                    lineHeight: '1',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 30px color-mix(in srgb, var(--st-secondary) 35%, transparent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {t('landing.exploreNow', 'Khám phá ngay')}
                  <ArrowRight
                    className="w-[18px] h-[18px]"
                    aria-hidden="true"
                  />
                </button>
                <button
                  className="bg-transparent border px-10 py-5 uppercase transition-all flex items-center gap-3"
                  style={{
                    borderColor: 'var(--st-outline)',
                    color: 'var(--st-on-surface)',
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '12px',
                    lineHeight: '1',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--st-surface-container-highest) 30%, transparent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {t('landing.viewMenu', 'Thực đơn')}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Section */}
        <section className="relative z-10 px-16 py-24 mb-32">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div
              className="p-10 group transition-transform duration-500"
              style={{
                background: 'rgba(148, 163, 184, 0.1)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderTop: '1px solid color-mix(in srgb, var(--st-outline) 20%, transparent)',
              }}
              data-glass-panel
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-8px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div
                className="w-12 h-12 flex items-center justify-center mb-8"
                style={{
                  border: '1px solid color-mix(in srgb, var(--st-secondary) 30%, transparent)',
                  borderRadius: 0,
                  boxShadow: '0 0 20px color-mix(in srgb, var(--st-secondary) 15%, transparent)',
                }}
              >
                <Coffee className="w-5 h-5" style={{ color: 'var(--st-secondary)' }} aria-hidden="true" />
              </div>
              <h3
                className="mb-4"
                style={{
                  fontFamily: "'EB Garamond', serif",
                  fontSize: '24px',
                  lineHeight: '1.4',
                  fontWeight: 600,
                  color: 'var(--st-on-surface)',
                }}
              >
                {t('landing.featureMenuTitle', 'Menu đa dạng')}
              </h3>
              <p
                className="mb-8 leading-relaxed"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '14px',
                  lineHeight: '1.5',
                  fontWeight: 400,
                  color: 'var(--st-on-surface-variant)',
                }}
              >
                {t(
                  'landing.featureMenuDesc',
                  'Từ những hạt Arabica tuyển chọn đến những công thức trà đặc biệt, được pha chế bởi những nghệ nhân barista tận tâm nhất.',
                )}
              </p>
              <a
                href="/menu"
                className="group-hover:underline flex items-center gap-2"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '12px',
                  lineHeight: '1',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--st-secondary)',
                }}
              >
                {t('landing.featureMenuLink', 'Xem chi tiết')}
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>

            {/* Card 2 */}
            <div
              className="p-10 group transition-transform duration-500"
              style={{
                background: 'rgba(148, 163, 184, 0.1)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderTop: '1px solid color-mix(in srgb, var(--st-outline) 20%, transparent)',
              }}
              data-glass-panel
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-8px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div
                className="w-12 h-12 flex items-center justify-center mb-8"
                style={{
                  border: '1px solid color-mix(in srgb, var(--st-secondary) 30%, transparent)',
                  borderRadius: 0,
                  boxShadow: '0 0 20px color-mix(in srgb, var(--st-secondary) 15%, transparent)',
                }}
              >
                <Seat className="w-5 h-5" style={{ color: 'var(--st-secondary)' }} aria-hidden="true" />
              </div>
              <h3
                className="mb-4"
                style={{
                  fontFamily: "'EB Garamond', serif",
                  fontSize: '24px',
                  lineHeight: '1.4',
                  fontWeight: 600,
                  color: 'var(--st-on-surface)',
                }}
              >
                {t('landing.featureReserveTitle', 'Đặt bàn nhanh')}
              </h3>
              <p
                className="mb-8 leading-relaxed"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '14px',
                  lineHeight: '1.5',
                  fontWeight: 400,
                  color: 'var(--st-on-surface-variant)',
                }}
              >
                {t(
                  'landing.featureReserveDesc',
                  'Đảm bảo vị trí ngồi lý tưởng trong không gian lounge sang trọng cho những cuộc gặp gỡ quan trọng hoặc những giây phút thư giãn.',
                )}
              </p>
              <a
                href="/table-reservation"
                className="group-hover:underline flex items-center gap-2"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '12px',
                  lineHeight: '1',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--st-secondary)',
                }}
              >
                {t('landing.featureReserveLink', 'Đặt chỗ ngay')}
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>

            {/* Card 3 */}
            <div
              className="p-10 group transition-transform duration-500"
              style={{
                background: 'rgba(148, 163, 184, 0.1)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderTop: '1px solid color-mix(in srgb, var(--st-outline) 20%, transparent)',
              }}
              data-glass-panel
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-8px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div
                className="w-12 h-12 flex items-center justify-center mb-8"
                style={{
                  border: '1px solid color-mix(in srgb, var(--st-secondary) 30%, transparent)',
                  borderRadius: 0,
                  boxShadow: '0 0 20px color-mix(in srgb, var(--st-secondary) 15%, transparent)',
                }}
              >
                <Truck className="w-5 h-5" style={{ color: 'var(--st-secondary)' }} aria-hidden="true" />
              </div>
              <h3
                className="mb-4"
                style={{
                  fontFamily: "'EB Garamond', serif",
                  fontSize: '24px',
                  lineHeight: '1.4',
                  fontWeight: 600,
                  color: 'var(--st-on-surface)',
                }}
              >
                {t('landing.featureDeliveryTitle', 'Giao tận nơi')}
              </h3>
              <p
                className="mb-8 leading-relaxed"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '14px',
                  lineHeight: '1.5',
                  fontWeight: 400,
                  color: 'var(--st-on-surface-variant)',
                }}
              >
                {t(
                  'landing.featureDeliveryDesc',
                  'Thưởng thức hương vị AURA ngay tại nhà hoặc văn phòng với dịch vụ giao hàng nhanh chóng trong khu vực Sa Đéc.',
                )}
              </p>
              <a
                href="/order"
                className="group-hover:underline flex items-center gap-2"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '12px',
                  lineHeight: '1',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--st-secondary)',
                }}
              >
                {t('landing.featureDeliveryLink', 'Đặt hàng')}
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        {/* Gallery / Detail Section */}
        <section
          className="relative z-10 px-16 py-24"
          style={{ backgroundColor: 'color-mix(in srgb, var(--st-surface-container-lowest) 50%, transparent)' }}
        >
          <div className="flex flex-col md:flex-row gap-20 items-center">
            <div className="w-full md:w-1/2 relative">
              <div
                className="p-2"
                style={{
                  background: 'rgba(148, 163, 184, 0.1)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  boxShadow: '0 0 20px color-mix(in srgb, var(--st-secondary) 15%, transparent)',
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
                  borderTop: '1px solid color-mix(in srgb, var(--st-secondary) 20%, transparent)',
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
            <div className="w-full md:w-1/2">
              <span
                className="mb-4 block tracking-[0.4em] uppercase"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '12px',
                  lineHeight: '1',
                  fontWeight: 600,
                  color: 'var(--st-secondary)',
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
                  color: 'var(--st-on-surface)',
                }}
              >
                {t('landing.galleryTitle', 'Nơi Công Nghiệp Gặp Gỡ Sự Sang Trọng')}
              </h2>
              <p
                className="mb-10 leading-relaxed"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '18px',
                  lineHeight: '1.6',
                  fontWeight: 400,
                  color: 'var(--st-on-surface-variant)',
                }}
              >
                {t(
                  'landing.galleryDescription',
                  'Aura Cafe không chỉ là một quán cà phê; đó là một tuyên ngôn về phong cách sống. Những khối container thô cứng được chúng tôi biến đổi thành không gian nghệ thuật với vật liệu cao cấp, ánh sáng thông minh và tâm hồn của những người yêu cái đẹp.',
                )}
              </p>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div
                    className="mt-1 w-2 h-2 shrink-0"
                    style={{ backgroundColor: 'var(--st-secondary)', borderRadius: 0 }}
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
                        color: 'var(--st-on-surface)',
                      }}
                    >
                      {t('landing.galleryBullet1Title', 'Vật liệu tinh tuyển')}
                    </h4>
                    <p
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: '14px',
                        lineHeight: '1.5',
                        fontWeight: 400,
                        color: 'var(--st-on-surface-variant)',
                      }}
                    >
                      {t(
                        'landing.galleryBullet1Desc',
                        'Sự kết hợp giữa thép không gỉ, kính cường lực mờ và gỗ sồi tự nhiên.',
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div
                    className="mt-1 w-2 h-2 shrink-0"
                    style={{ backgroundColor: 'var(--st-secondary)', borderRadius: 0 }}
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
                        color: 'var(--st-on-surface)',
                      }}
                    >
                      {t('landing.galleryBullet2Title', 'Ánh sáng cảm xúc')}
                    </h4>
                    <p
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: '14px',
                        lineHeight: '1.5',
                        fontWeight: 400,
                        color: 'var(--st-on-surface-variant)',
                      }}
                    >
                      {t(
                        'landing.galleryBullet2Desc',
                        'Hệ thống chiếu sáng được thiết kế bởi chuyên gia, tối ưu cho trải nghiệm buổi tối.',
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Location Section */}
        <section className="relative z-10 px-16 py-24 mb-16">
          <div
            className="p-12"
            style={{
              background: 'rgba(148, 163, 184, 0.1)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderTop: '1px solid color-mix(in srgb, var(--st-outline) 20%, transparent)',
            }}
            data-glass-panel
          >
            <div className="flex flex-col md:flex-row justify-between items-center gap-12">
              <div className="max-w-md w-full">
                <h2
                  className="mb-6"
                  style={{
                    fontFamily: "'EB Garamond', serif",
                    fontSize: '32px',
                    lineHeight: '1.3',
                    fontWeight: 500,
                    color: 'var(--st-on-surface)',
                  }}
                >
                  {t('landing.locationTitle', 'Ghé thăm chúng tôi tại Sa Đéc')}
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center gap-4" style={{ color: 'var(--st-on-surface-variant)' }}>
                    <MapPin
                      className="w-5 h-5 shrink-0"
                      style={{ color: 'var(--st-secondary)' }}
                      aria-hidden="true"
                    />
                    <span
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: '16px',
                        lineHeight: '1.6',
                        fontWeight: 400,
                      }}
                    >
                      {t(
                        'landing.locationAddress',
                        'Đường Nguyễn Sinh Sắc, Phường 2, Sa Đéc, Đồng Tháp',
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-4" style={{ color: 'var(--st-on-surface-variant)' }}>
                    <Clock
                      className="w-5 h-5 shrink-0"
                      style={{ color: 'var(--st-secondary)' }}
                      aria-hidden="true"
                    />
                    <span
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: '16px',
                        lineHeight: '1.6',
                        fontWeight: 400,
                      }}
                    >
                      {t('landing.locationHours', 'Mở cửa: 07:00 - 23:00 mỗi ngày')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4" style={{ color: 'var(--st-on-surface-variant)' }}>
                    <Phone
                      className="w-5 h-5 shrink-0"
                      style={{ color: 'var(--st-secondary)' }}
                      aria-hidden="true"
                    />
                    <span
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: '16px',
                        lineHeight: '1.6',
                        fontWeight: 400,
                      }}
                    >
                      {t('landing.locationPhone', '+84 277 123 456')}
                    </span>
                  </div>
                </div>
              </div>
              <div
                className="w-full md:w-1/2 h-64 overflow-hidden"
                style={{
                  background: 'rgba(148, 163, 184, 0.1)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid color-mix(in srgb, var(--st-outline) 30%, transparent)',
                }}
                data-glass-panel
              >
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{ backgroundImage: `url('${locationMapUrl}')` }}
                  role="img"
                  aria-label={t(
                    'landing.locationMapAlt',
                    'Map showing AURA CAFE location in Sa Dec, Dong Thap',
                  )}
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="w-full border-t mt-20"
        style={{
          borderColor: 'color-mix(in srgb, var(--st-outline-variant) 20%, transparent)',
          backgroundColor: 'var(--st-surface-dim)',
        }}
      >
        <div className="flex flex-col md:flex-row justify-between items-center px-16 py-12 w-full gap-8">
          <div className="flex flex-col gap-4">
            <div
              style={{
                fontFamily: "'EB Garamond', serif",
                fontSize: '24px',
                lineHeight: '1.4',
                fontWeight: 600,
                color: 'var(--st-on-surface)',
              }}
            >
              AURA CAFE
            </div>
            <p
              className="max-w-xs uppercase tracking-widest"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '14px',
                lineHeight: '1.5',
                fontWeight: 400,
                color: 'var(--st-on-surface-variant)',
                opacity: 0.6,
              }}
            >
              {t('landing.footerTagline', 'Architectural Container Coffee Experience')}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            <a
              href="/contact"
              className="uppercase tracking-wider transition-colors"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '14px',
                lineHeight: '1.5',
                fontWeight: 400,
                color: 'var(--st-on-surface-variant)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--st-secondary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--st-on-surface-variant)'; }}
            >
              {t('landing.footerContact', 'Contact Us')}
            </a>
            <a
              href="/privacy"
              className="uppercase tracking-wider transition-colors"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '14px',
                lineHeight: '1.5',
                fontWeight: 400,
                color: 'var(--st-on-surface-variant)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--st-secondary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--st-on-surface-variant)'; }}
            >
              {t('landing.footerPrivacy', 'Privacy Policy')}
            </a>
            <a
              href="/terms"
              className="uppercase tracking-wider transition-colors"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '14px',
                lineHeight: '1.5',
                fontWeight: 400,
                color: 'var(--st-on-surface-variant)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--st-secondary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--st-on-surface-variant)'; }}
            >
              {t('landing.footerTerms', 'Terms of Service')}
            </a>
            <a
              href="https://instagram.com/auracafe"
              target="_blank"
              rel="noopener noreferrer"
              className="uppercase tracking-wider transition-colors"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '14px',
                lineHeight: '1.5',
                fontWeight: 400,
                color: 'var(--st-on-surface-variant)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--st-secondary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--st-on-surface-variant)'; }}
            >
              {t('landing.footerInstagram', 'Instagram')}
            </a>
            <a
              href="https://facebook.com/auracafe"
              target="_blank"
              rel="noopener noreferrer"
              className="uppercase tracking-wider transition-colors"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '14px',
                lineHeight: '1.5',
                fontWeight: 400,
                color: 'var(--st-on-surface-variant)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--st-secondary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--st-on-surface-variant)'; }}
            >
              {t('landing.footerFacebook', 'Facebook')}
            </a>
          </div>
          <div
            className="text-center md:text-left"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '14px',
              lineHeight: '1.5',
              fontWeight: 400,
              color: 'var(--st-on-surface-variant)',
              opacity: 0.6,
            }}
          >
            {t('landing.copyright', '© 2024 AURA CAFE SA DEC. ALL RIGHTS RESERVED.')}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default StitchLandingNew;
