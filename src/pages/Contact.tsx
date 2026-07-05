import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { SocialShare } from '@/components/shared/SocialShare';
import { ContactForm } from '@/components/contact/ContactForm';
import { LocationMap } from '@/components/contact/LocationMap';
import { HoursDisplay } from '@/components/contact/HoursDisplay';
import { Phone } from 'lucide-react';

export function Contact() {
 const { t } = useTranslation('contact');

 const BREADCRUMBS = [
   { label: t('breadcrumbHome'), to: '/' },
   { label: t('breadcrumbContact'), to: '/contact' },
 ];

 return (
 <>
 <HelmetHead
 title={t('seoTitle')}
 description={t('seoDescription')}
 canonical="/contact"
 />
 <div className="bg-[color:var(--aura-noir-deep)] text-[color:var(--aura-chrome-bright)] mx-auto max-w-6xl px-4 md:px-6 py-8">
 {/* Breadcrumbs */}
 <Breadcrumbs items={BREADCRUMBS} className="mb-8" />

 {/* Header */}
 <div className="mb-12 text-center">
 <span className="font-utility text-xs font-semibold uppercase tracking-[4px] text-[color:var(--aura-chrome-bright)]">
 {t('subtitle')}
 </span>
 <h1 className="mt-2 font-display text-4xl font-bold text-[color:var(--aura-chrome-bright)] md:text-5xl">
 {t('title')}
 </h1>
 <p className="mt-3 text-[color:var(--aura-chrome-bright)]">
 {t('description')}
 </p>
 </div>

 {/* Layout: Form + Info */}
 <div className="grid gap-8 lg:grid-cols-5">
 {/* Left: Contact Form */}
 <div className="lg:col-span-3">
 <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl p-6 md:p-8">
 <h2 className="font-display text-2xl font-semibold text-[color:var(--aura-chrome-bright)]">
 {t('sendMessage')}
 </h2>
 <p className="mt-1 text-sm text-[color:var(--aura-chrome-bright)]">
 {t('feedbackMatters')}
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
 <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl p-6">
 <h3 className="font-display text-lg font-semibold text-[color:var(--aura-chrome-bright)]">
 {t('followUs')}
 </h3>
 <SocialShare className="mt-3" />
 </div>

 {/* Hotline */}
 <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl p-6">
 <div className="mb-1 text-2xl" aria-hidden="true"><Phone size={24} className="inline" /></div>
 <h3 className="font-display text-lg font-semibold text-[color:var(--aura-chrome-bright)]">
 {t('hotline')}
 </h3>
 <a
 href="tel:0946013633"
 className="mt-2 inline-block text-lg font-semibold text-[color:var(--aura-chrome-bright)] transition-colors hover:text-[color:var(--aura-chrome-bright)]"
 >
 0946 013 633
 </a>
 <p className="mt-1 text-xs text-[color:var(--aura-chrome-bright)]">
 {t('weekdayHours')}
 </p>
 <p className="text-xs text-[color:var(--aura-chrome-bright)]">
 {t('weekendHours')}
 </p>
 </div>
 </div>
 </div>
 </div>
 </>
 );
}
