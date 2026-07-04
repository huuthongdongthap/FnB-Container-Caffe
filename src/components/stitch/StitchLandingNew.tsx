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

  return (
    <div
      className="relative min-h-screen text-[#d8e3fb] overflow-x-hidden"
      style={{ backgroundColor: '#081425' }}
      aria-label={t('landing.pageAriaLabel', 'AURA CAFE — Luxury Container Cafe Landing Page')}
    >
      {/* Navigation */}
      <nav
        className="fixed top-0 w-full z-50 flex justify-between items-center px-16 py-4 backdrop-blur-xl border-b border-[#44474d]/30"
        style={{ backgroundColor: 'rgba(8, 20, 37, 0.15)' }}
        aria-label={t('landing.navAriaLabel', 'Main navigation — AURA CAFE')}
      >
        <div
          className="text-[32px] leading-[1.3] font-medium text-[#d8e3fb] tracking-tight"
          style={{ fontFamily: "'EB Garamond', serif" }}
        >
          AURA CAFE
        </div>
        <div className="hidden md:flex items-center gap-10">
          <a
            href="/menu"
            className="text-[24px] leading-[1.4] font-semibold text-[#efbd8a] border-b-2 border-[#efbd8a] pb-1"
            style={{ fontFamily: "'EB Garamond', serif" }}
          >
            {t('nav.menu')}
          </a>
          <a
            href="/table-reservation"
            className="text-[24px] leading-[1.4] font-semibold text-[#c5c6cd] hover:text-[#d8e3fb] transition-colors"
            style={{ fontFamily: "'EB Garamond', serif" }}
          >
            {t('landing.reservation', 'Reservation')}
          </a>
          <a
            href="/about"
            className="text-[24px] leading-[1.4] font-semibold text-[#c5c6cd] hover:text-[#d8e3fb] transition-colors"
            style={{ fontFamily: "'EB Garamond', serif" }}
          >
            {t('landing.location', 'Location')}
          </a>
          <a
            href="/about"
            className="text-[24px] leading-[1.4] font-semibold text-[#c5c6cd] hover:text-[#d8e3fb] transition-colors"
            style={{ fontFamily: "'EB Garamond', serif" }}
          >
            {t('landing.about', 'About')}
          </a>
        </div>
        <button
          className="px-6 py-2 text-xs leading-[1] tracking-[0.1em] font-semibold uppercase text-[#472a03] active:opacity-80 active:scale-95 transition-all duration-300"
          style={{ backgroundColor: '#efbd8a', fontFamily: "'Space Grotesk', sans-serif" }}
          aria-label={t('landing.orderNowAria', 'Order now via online ordering system')}
        >
          {t('landing.orderNow', 'Order Now')}
        </button>
      </nav>

      {/* Main Content */}
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
          style={{ backgroundColor: 'rgba(239, 189, 138, 0.1)' }}
          aria-hidden="true"
        />
        <div
          className="absolute bottom-1/4 -left-24 w-96 h-96 rounded-full blur-[120px] pointer-events-none"
          style={{ backgroundColor: 'rgba(184, 199, 226, 0.1)' }}
          aria-hidden="true"
        />

        {/* Hero Section */}
        <section
          className="relative z-10 px-16 py-20 flex flex-col items-center justify-center min-h-[870px] text-center"
          aria-label={t('landing.heroAriaLabel', 'Hero section — AURA CAFE introduction')}
        >
          <div
            className="relative p-12 md:p-24 max-w-5xl w-full overflow-hidden"
            style={{
              background: 'rgba(148, 163, 184, 0.1)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderTop: '1px solid rgba(142, 144, 151, 0.3)',
            }}
          >
            {/* Hero Background Image */}
            <div
              className="absolute inset-0 opacity-40 z-0"
              aria-hidden="true"
            >
              <div
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url('${heroBgUrl}')` }}
              />
            </div>
            <div className="relative z-10 flex flex-col items-center">
              <p
                className="text-xs leading-[1] tracking-[0.4em] uppercase mb-6 font-semibold text-[#efbd8a]"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {t('landing.heroTagline', 'Sa Dec · Premium Coffee')}
              </p>
              <h1
                className="text-[64px] leading-[1.1] tracking-[-0.02em] font-medium text-[#d8e3fb] mb-8 max-w-3xl"
                style={{ fontFamily: "'EB Garamond', serif" }}
              >
                {t('landing.heroTitle', 'AURA CAFE')}
              </h1>
              <p
                className="text-[18px] leading-[1.6] text-[#c5c6cd] max-w-2xl mb-12"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {t('landing.heroDescription', 'A premium container coffee experience in an elegant industrial space. Where light and shadow blend into a unique architectural symphony.')}
              </p>
              <div className="flex flex-col sm:flex-row gap-6">
                <button
                  className="text-[#0c1c30] px-10 py-5 text-xs tracking-[0.1em] font-semibold uppercase flex items-center gap-3 transition-all duration-500"
                  style={{
                    background: 'linear-gradient(135deg, #D4A574 0%, #B48554 100%)',
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 30px rgba(212, 165, 116, 0.35)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  aria-label={t('landing.exploreNowAria', 'Explore AURA CAFE experience')}
                >
                  {t('landing.exploreNow', 'Khám phá ngay')}
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  className="bg-transparent border border-[#8e9097] px-10 py-5 text-xs tracking-[0.1em] font-semibold uppercase text-[#d8e3fb] hover:bg-[#2a3548]/30 transition-all"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  aria-label={t('landing.viewMenuAria', 'View our menu')}
                >
                  {t('landing.viewMenu', 'Thực đơn')}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Cards Section */}
        <section
          className="relative z-10 px-16 py-24 mb-32"
          aria-label={t('landing.featuresAriaLabel', 'Feature highlight cards')}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Menu */}
            <div
              className="relative p-10 group hover:-translate-y-2 transition-transform duration-500"
              style={{
                background: 'rgba(148, 163, 184, 0.1)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderTop: '1px solid rgba(142, 144, 151, 0.2)',
              }}
              aria-label={t('landing.featureMenuCardAria', 'Feature card: diverse menu options')}
            >
              <div
                className="w-12 h-12 flex items-center justify-center mb-8 border border-[#efbd8a]/30"
                style={{ boxShadow: '0 0 20px rgba(212, 165, 116, 0.15)' }}
              >
                <Coffee className="w-5 h-5 text-[#efbd8a]" aria-hidden="true" />
              </div>
              <h3
                className="text-[24px] leading-[1.4] font-semibold mb-4 text-[#d8e3fb]"
                style={{ fontFamily: "'EB Garamond', serif" }}
              >
                {t('landing.featureMenuTitle', 'Menu đa dạng')}
              </h3>
              <p
                className="text-sm leading-relaxed text-[#c5c6cd] mb-8"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {t('landing.featureMenuDesc', 'From hand-selected Arabica beans to specialty tea blends, crafted by the most dedicated barista artisans.')}
              </p>
              <a
                href="/menu"
                className="text-xs tracking-[0.1em] uppercase font-semibold text-[#efbd8a] group-hover:underline flex items-center gap-2"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                aria-label={t('landing.featureMenuLinkAria', 'View menu details')}
              >
                {t('landing.featureMenuLink', 'Xem chi tiết')}
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>

            {/* Card 2: Reservation */}
            <div
              className="relative p-10 group hover:-translate-y-2 transition-transform duration-500"
              style={{
                background: 'rgba(148, 163, 184, 0.1)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderTop: '1px solid rgba(142, 144, 151, 0.2)',
              }}
              aria-label={t('landing.featureReserveCardAria', 'Feature card: quick table reservation')}
            >
              <div
                className="w-12 h-12 flex items-center justify-center mb-8 border border-[#efbd8a]/30"
                style={{ boxShadow: '0 0 20px rgba(212, 165, 116, 0.15)' }}
              >
                <Seat className="w-5 h-5 text-[#efbd8a]" aria-hidden="true" />
              </div>
              <h3
                className="text-[24px] leading-[1.4] font-semibold mb-4 text-[#d8e3fb]"
                style={{ fontFamily: "'EB Garamond', serif" }}
              >
                {t('landing.featureReserveTitle', 'Đặt bàn nhanh')}
              </h3>
              <p
                className="text-sm leading-relaxed text-[#c5c6cd] mb-8"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {t('landing.featureReserveDesc', 'Secure your ideal seat in our luxurious lounge space for important meetings or relaxing moments.')}
              </p>
              <a
                href="/table-reservation"
                className="text-xs tracking-[0.1em] uppercase font-semibold text-[#efbd8a] group-hover:underline flex items-center gap-2"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                aria-label={t('landing.featureReserveLinkAria', 'Book a table now')}
              >
                {t('landing.featureReserveLink', 'Đặt chỗ ngay')}
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>

            {/* Card 3: Delivery */}
            <div
              className="relative p-10 group hover:-translate-y-2 transition-transform duration-500"
              style={{
                background: 'rgba(148, 163, 184, 0.1)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderTop: '1px solid rgba(142, 144, 151, 0.2)',
              }}
              aria-label={t('landing.featureDeliveryCardAria', 'Feature card: delivery service')}
            >
              <div
                className="w-12 h-12 flex items-center justify-center mb-8 border border-[#efbd8a]/30"
                style={{ boxShadow: '0 0 20px rgba(212, 165, 116, 0.15)' }}
              >
                <Truck className="w-5 h-5 text-[#efbd8a]" aria-hidden="true" />
              </div>
              <h3
                className="text-[24px] leading-[1.4] font-semibold mb-4 text-[#d8e3fb]"
                style={{ fontFamily: "'EB Garamond', serif" }}
              >
                {t('landing.featureDeliveryTitle', 'Giao tận nơi')}
              </h3>
              <p
                className="text-sm leading-relaxed text-[#c5c6cd] mb-8"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {t('landing.featureDeliveryDesc', 'Enjoy AURA flavors at home or office with our fast delivery service throughout Sa Dec area.')}
              </p>
              <a
                href="/order"
                className="text-xs tracking-[0.1em] uppercase font-semibold text-[#efbd8a] group-hover:underline flex items-center gap-2"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                aria-label={t('landing.featureDeliveryLinkAria', 'Order delivery now')}
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
          style={{ backgroundColor: 'rgba(4, 14, 31, 0.5)' }}
          aria-label={t('landing.galleryAriaLabel', 'Gallery and architecture detail section')}
        >
          <div className="flex flex-col md:flex-row gap-20 items-center">
            {/* Gallery Images */}
            <div className="w-full md:w-1/2 relative">
              <div
                className="relative p-2"
                style={{
                  background: 'rgba(148, 163, 184, 0.1)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  boxShadow: '0 0 20px rgba(212, 165, 116, 0.15)',
                }}
              >
                <div
                  className="w-full h-[300px] md:h-[500px] bg-cover bg-center"
                  style={{ backgroundImage: `url('${galleryMainUrl}')` }}
                  role="img"
                  aria-label={t('landing.galleryMainAlt', 'Interior of the luxury container cafe at night with warm amber lighting and industrial design')}
                />
              </div>
              <div
                className="absolute -bottom-10 -right-10 w-48 h-48 hidden md:block p-4"
                style={{
                  background: 'rgba(148, 163, 184, 0.1)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  borderTop: '1px solid rgba(239, 189, 138, 0.2)',
                }}
              >
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{ backgroundImage: `url('${galleryInsetUrl}')` }}
                  role="img"
                  aria-label={t('landing.galleryInsetAlt', 'Close-up of a perfectly crafted latte with intricate leaf art')}
                />
              </div>
            </div>

            {/* Gallery Text */}
            <div className="w-full md:w-1/2">
              <p
                className="text-xs leading-[1] tracking-[0.4em] uppercase mb-4 font-semibold text-[#efbd8a]"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {t('landing.gallerySubtitle', 'Kiến Trúc Độc Bản')}
              </p>
              <h2
                className="text-[48px] leading-[1.2] tracking-[-0.01em] font-medium text-[#d8e3fb] mb-8"
                style={{ fontFamily: "'EB Garamond', serif" }}
              >
                {t('landing.galleryTitle', 'Nơi Công Nghiệp Gặp Gỡ Sự Sang Trọng')}
              </h2>
              <p
                className="text-[18px] leading-[1.6] text-[#c5c6cd] mb-10"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {t('landing.galleryDescription', 'Aura Cafe is more than just a coffee shop; it is a lifestyle statement. We transform raw shipping containers into artistic spaces with premium materials, intelligent lighting, and the soul of aesthetes.')}
              </p>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div
                    className="mt-1 w-2 h-2 shrink-0"
                    style={{ backgroundColor: '#efbd8a' }}
                    aria-hidden="true"
                  />
                  <div>
                    <h4
                      className="text-xs tracking-[0.1em] uppercase font-semibold text-[#d8e3fb] mb-1"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {t('landing.galleryBullet1Title', 'Vật liệu tinh tuyển')}
                    </h4>
                    <p
                      className="text-sm text-[#c5c6cd]"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {t('landing.galleryBullet1Desc', 'A fusion of stainless steel, frosted tempered glass, and natural oak wood.')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div
                    className="mt-1 w-2 h-2 shrink-0"
                    style={{ backgroundColor: '#efbd8a' }}
                    aria-hidden="true"
                  />
                  <div>
                    <h4
                      className="text-xs tracking-[0.1em] uppercase font-semibold text-[#d8e3fb] mb-1"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {t('landing.galleryBullet2Title', 'Ánh sáng cảm xúc')}
                    </h4>
                    <p
                      className="text-sm text-[#c5c6cd]"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {t('landing.galleryBullet2Desc', 'Lighting system designed by experts, optimized for evening experiences.')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Location Section */}
        <section
          className="relative z-10 px-16 py-24 mb-16"
          aria-label={t('landing.locationAriaLabel', 'Location and contact information')}
        >
          <div
            className="p-12"
            style={{
              background: 'rgba(148, 163, 184, 0.1)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderTop: '1px solid rgba(142, 144, 151, 0.2)',
            }}
          >
            <div className="flex flex-col md:flex-row justify-between items-center gap-12">
              <div className="max-w-md w-full">
                <h2
                  className="text-[32px] leading-[1.3] font-medium text-[#d8e3fb] mb-6"
                  style={{ fontFamily: "'EB Garamond', serif" }}
                >
                  {t('landing.locationTitle', 'Ghé thăm chúng tôi tại Sa Đéc')}
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-[#c5c6cd]">
                    <MapPin className="w-5 h-5 text-[#efbd8a] shrink-0" aria-hidden="true" />
                    <span
                      className="text-[16px] leading-[1.6]"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {t('landing.locationAddress', 'Đường Nguyễn Sinh Sắc, Phường 2, Sa Đéc, Đồng Tháp')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[#c5c6cd]">
                    <Clock className="w-5 h-5 text-[#efbd8a] shrink-0" aria-hidden="true" />
                    <span
                      className="text-[16px] leading-[1.6]"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {t('landing.locationHours', 'Mở cửa: 07:00 - 23:00 mỗi ngày')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[#c5c6cd]">
                    <Phone className="w-5 h-5 text-[#efbd8a] shrink-0" aria-hidden="true" />
                    <span
                      className="text-[16px] leading-[1.6]"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {t('landing.locationPhone', '+84 277 123 456')}
                    </span>
                  </div>
                </div>
              </div>
              <div
                className="w-full md:w-1/2 h-48 md:h-64 overflow-hidden border border-[#8e9097]/30"
                style={{
                  background: 'rgba(148, 163, 184, 0.1)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                }}
              >
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{ backgroundImage: `url('${locationMapUrl}')` }}
                  role="img"
                  aria-label={t('landing.locationMapAlt', 'Map showing AURA CAFE location in Sa Dec, Dong Thap')}
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="w-full border-t border-[#44474d]/20 mt-20"
        style={{ backgroundColor: '#081425' }}
        aria-label={t('landing.footerAriaLabel', 'Footer — AURA CAFE links and copyright')}
      >
        <div className="flex flex-col md:flex-row justify-between items-center px-16 py-12 w-full gap-8">
          <div className="flex flex-col gap-4">
            <div
              className="text-[24px] leading-[1.4] font-semibold text-[#d8e3fb]"
              style={{ fontFamily: "'EB Garamond', serif" }}
            >
              AURA CAFE
            </div>
            <p
              className="text-[14px] leading-[1.5] text-[#c5c6cd] max-w-xs uppercase tracking-widest"
              style={{ opacity: 0.6, fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t('landing.footerTagline', 'Architectural Container Coffee Experience')}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            <a
              href="/contact"
              className="text-[14px] leading-[1.5] text-[#c5c6cd] hover:text-[#efbd8a] transition-colors uppercase tracking-wider"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              aria-label={t('landing.footerContactAria', 'Contact AURA CAFE')}
            >
              {t('landing.footerContact', 'Contact Us')}
            </a>
            <a
              href="/privacy"
              className="text-[14px] leading-[1.5] text-[#c5c6cd] hover:text-[#efbd8a] transition-colors uppercase tracking-wider"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              aria-label={t('landing.footerPrivacyAria', 'View privacy policy')}
            >
              {t('landing.footerPrivacy', 'Privacy Policy')}
            </a>
            <a
              href="/terms"
              className="text-[14px] leading-[1.5] text-[#c5c6cd] hover:text-[#efbd8a] transition-colors uppercase tracking-wider"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              aria-label={t('landing.footerTermsAria', 'View terms of service')}
            >
              {t('landing.footerTerms', 'Terms of Service')}
            </a>
            <a
              href="https://instagram.com/auracafe"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[14px] leading-[1.5] text-[#c5c6cd] hover:text-[#efbd8a] transition-colors uppercase tracking-wider"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              aria-label={t('landing.footerInstagramAria', 'Follow AURA CAFE on Instagram')}
            >
              {t('landing.footerInstagram', 'Instagram')}
            </a>
            <a
              href="https://facebook.com/auracafe"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[14px] leading-[1.5] text-[#c5c6cd] hover:text-[#efbd8a] transition-colors uppercase tracking-wider"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              aria-label={t('landing.footerFacebookAria', 'Follow AURA CAFE on Facebook')}
            >
              {t('landing.footerFacebook', 'Facebook')}
            </a>
          </div>
          <div
            className="text-[14px] leading-[1.5] text-[#c5c6cd] text-center md:text-left"
            style={{ opacity: 0.6, fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {t('landing.copyright', '© 2024 AURA CAFE SA DEC. ALL RIGHTS RESERVED.', { year: 2024 })}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default StitchLandingNew;
