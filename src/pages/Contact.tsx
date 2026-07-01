import { SEOHead } from '@/components/shared/SEOHead';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { SocialShare } from '@/components/shared/SocialShare';
import { ContactForm } from '@/components/contact/ContactForm';
import { LocationMap } from '@/components/contact/LocationMap';
import { HoursDisplay } from '@/components/contact/HoursDisplay';

const BREADCRUMBS = [
  { label: 'Trang chủ', to: '/' },
  { label: 'Liên hệ', to: '/contact' },
];

export function Contact() {
  return (
    <>
      <SEOHead
        title="Liên Hệ | AURA CAFE"
        description="Liên hệ với AURA CAFE để đóng góp ý kiến hoặc nhận hỗ trợ nhanh nhất. 39 Nguyễn Tất Thành, Sa Đéc, Đồng Tháp."
        ogTitle="Liên Hệ | AURA CAFE"
        ogDescription="Liên hệ với AURA CAFE — góp ý hoặc nhận hỗ trợ"
        ogType="website"
      />

      <main id="main-content" className="mx-auto max-w-6xl px-4 py-8">
        {/* Breadcrumbs */}
        <Breadcrumbs items={BREADCRUMBS} className="mb-8" />

        {/* Header */}
        <div className="mb-12 text-center">
          <span className="font-utility text-xs font-semibold uppercase tracking-[4px] text-accent">
            Liên Hệ &amp; Góp Ý
          </span>
          <h1 className="mt-2 font-display text-4xl font-bold text-foreground md:text-5xl">
            Kết Nối Với Chúng Tôi
          </h1>
          <p className="mt-3 text-muted">
            Mọi phản hồi đều giúp chúng tôi phục vụ bạn tốt hơn.
          </p>
        </div>

        {/* Layout: Form + Info */}
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Left: Contact Form */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <h2 className="font-display text-2xl font-semibold text-foreground">
                Gửi Tin Nhắn
              </h2>
              <p className="mt-1 text-sm text-muted">
                Phản hồi của bạn rất quan trọng
              </p>
              <ContactForm className="mt-6" />
            </div>
          </div>

          {/* Right: Info */}
          <div className="space-y-6 lg:col-span-2">
            {/* Address + Map */}
            <LocationMap />

            {/* Hours */}
            <HoursDisplay />

            {/* Social */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="font-display text-lg font-semibold text-foreground">
                Theo Dõi Chúng Tôi
              </h3>
              <SocialShare className="mt-3" />
            </div>

            {/* Hotline */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-1 text-2xl" aria-hidden="true">&#128222;</div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                Hotline
              </h3>
              <a
                href="tel:0946013633"
                className="mt-2 inline-block text-lg font-semibold text-foreground transition-colors hover:text-accent"
              >
                0946 013 633
              </a>
              <p className="mt-1 text-xs text-muted">
                Thứ 2 &mdash; Thứ 6: 06:00 &mdash; 22:00
              </p>
              <p className="text-xs text-muted">
                Thứ 7 &mdash; Chủ Nhật: 06:00 &mdash; 23:00
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
