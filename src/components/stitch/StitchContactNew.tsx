/**
 * StitchContactNew — Contact page for AURA CAFE
 *
 * Regenerated from the original Stitch HTML export:
 *   stitch-exports/new-screens/contact.html
 *
 * Design tokens mapped to --aura-* CSS variables:
 *   --aura-surface-dim    -> main bg (#081425)
 *   --aura-chrome-bright  -> bright text (#c6c6c7)
 *   --aura-chrome-soft    -> muted text (#a0a0a0)
 *   --aura-bronze-shimmer -> CTA/accent (#d4a574)
 *   Display font: 'EB Garamond', serif
 *   Body font: 'Space Grotesk', sans-serif
 */
'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { cn } from '@/lib/cn';
import {
  Search,
  UserCircle,
  Share2,
  ThumbsUp,
  Camera,
  ArrowRight,
  MapPin,
} from 'lucide-react';

/* ─── Glass panel style ─────────────────────────────────────────── */

const glassPanelClasses =
  'bg-[rgba(198,198,199,0.1)] backdrop-blur-[24px] border-t border-l border-[rgba(198,198,199,0.3)] border-r border-b border-[var(--aura-bronze-shimmer)]/50';

/* ─── Props ─────────────────────────────────────────────────────── */

export interface StitchContactNewProps {
  onSubmit?: (data: { name: string; email: string; message: string }) => void;
  onNavigate?: (path: string) => void;
  isSubmitting?: boolean;
}

/* ─── Inline Icon button ────────────────────────────────────────── */

function SocialIconButton({
  icon: Icon,
  onClick,
  label,
}: {
  icon: React.ElementType;
  onClick?: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 border border-[var(--aura-chrome-bright)]/20 flex items-center justify-center hover:bg-[var(--aura-bronze-shimmer)] hover:text-white/90 transition-all"
      aria-label={label}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}

/* ─── Form field component ──────────────────────────────────────── */

function FormField({
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
  multiline,
}: {
  label: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const hasValue = value.length > 0;
  const showBronze = focused || hasValue;

  const inputClasses =
    'w-full bg-transparent border-0 border-b py-2 text-[var(--aura-chrome-bright)] outline-none transition-colors placeholder:text-[var(--aura-chrome-soft)]/40 font-[\'Space_Grotesk\']';

  return (
    <div className="group">
      <label
        className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase block mb-1 transition-colors"
        style={{ color: showBronze ? 'var(--aura-bronze-shimmer)' : 'var(--aura-chrome-soft)' }}
      >
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          rows={4}
          className={cn(inputClasses, 'resize-none')}
          style={{ borderBottomColor: showBronze ? 'var(--aura-bronze-shimmer)' : 'var(--aura-chrome-bright)/30' }}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className={inputClasses}
          style={{ borderBottomColor: showBronze ? 'var(--aura-bronze-shimmer)' : 'var(--aura-chrome-bright)/30' }}
        />
      )}
    </div>
  );
}

/* ─── Component ─────────────────────────────────────────────────── */

export function StitchContactNew({
  onSubmit,
  onNavigate,
  isSubmitting,
}: StitchContactNewProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (name && email && message) {
        onSubmit?.({ name, email, message });
      }
    },
    [name, email, message, onSubmit],
  );

  return (
    <>
      <HelmetHead
        title="Contact"
        description="Visit AURA CAFE at 39 Nguyen Tat Thanh, Sa Dec, Dong Thap, Vietnam. Get in touch with our team."
      />

      {/* Top Navigation */}
      <header className="fixed top-0 w-full z-50 bg-[var(--aura-surface-dim)]/80 backdrop-blur-xl border-b border-white/10 flex justify-between items-center px-6 h-16">
        <div className="font-['EB_Garamond'] text-[24px] font-bold leading-tight text-[var(--aura-chrome-bright)] tracking-tight">
          AURA CAFE
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => onNavigate?.('/search')}
            className="text-[var(--aura-chrome-bright)] hover:opacity-80 transition-opacity active:scale-95 duration-200"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            onClick={() => onNavigate?.('/account')}
            className="text-[var(--aura-chrome-bright)] hover:opacity-80 transition-opacity active:scale-95 duration-200"
            aria-label="Account"
          >
            <UserCircle className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="pt-16 min-h-screen bg-[var(--aura-surface-dim)]">
        {/* Hero Section */}
        <section className="relative h-[353px] md:h-[442px] flex items-center px-6 overflow-hidden">
          <div className="relative z-10 w-full">
            <p className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-bronze-shimmer)] mb-2">
              {t('contact.heroLabel', 'LOCATION & ENQUIRIES')}
            </p>
            <h1 className="font-['EB_Garamond'] text-[36px] md:text-[48px] leading-none tracking-tighter uppercase max-w-xl text-[var(--aura-chrome-bright)]">
              {t('contact.heroTitle', "Connect with \nthe Aura")}
            </h1>
          </div>

          {/* Texture overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20 mix-blend-overlay"
            style={{
              backgroundImage:
                'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAFXTs155hge8D4zE7vJmkngZEEj_vs9UbJb7SixusWpzPIrw4p1IMr17yLfQNRrDrDOC2U6GAgU7dfnyttYqtV0VV3OnBdrHPEn9LVoel9dLJZvFC28PMVrGnn2R-qhHt7bOfGpe4ibKuhLH9az0Gxo1xTwlvasKquSy1fRqxj25LLmJFFdx0YL9kQeBbM_LCgnzwFBldFvK7Al_5vkT9uxtts5TXomUvGaUyyA68lq0hdci5hyUIbuX6ExpHgm9ZDtFaV988Jimo")',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        </section>

        {/* Content Grid */}
        <div className="px-6 pb-12 max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Contact Info Card */}
          <div className={cn(glassPanelClasses, 'md:col-span-5 p-6 flex flex-col gap-6')}>
            <div>
              <h3 className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-bronze-shimmer)] mb-2">
                {t('contact.address', 'ADDRESS')}
              </h3>
              <p className="font-['Space_Grotesk'] text-[18px] leading-relaxed text-[var(--aura-text-primary)]">
                39 Nguyễn Tất Thành, Sa Đéc,<br />
                Đồng Tháp, Vietnam
              </p>
            </div>

            <div className="w-full h-px bg-white/10" />

            <div>
              <h3 className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-bronze-shimmer)] mb-2">
                {t('contact.phone', 'DIRECT LINE')}
              </h3>
              <p className="font-['Space_Grotesk'] text-[18px] leading-relaxed text-[var(--aura-text-primary)]">
                (000) 000-0000
              </p>
            </div>

            <div className="w-full h-px bg-white/10" />

            <div>
              <h3 className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-bronze-shimmer)] mb-2">
                {t('contact.email', 'ELECTRONIC MAIL')}
              </h3>
              <p className="font-['Space_Grotesk'] text-[18px] leading-relaxed text-[var(--aura-text-primary)]">
                contact@auracafe.vn
              </p>
            </div>

            {/* Social links */}
            <div className="mt-auto pt-6 flex gap-4">
              <SocialIconButton icon={Share2} label="Share" onClick={() => onNavigate?.('/share')} />
              <SocialIconButton icon={ThumbsUp} label="Like" onClick={() => onNavigate?.('/social')} />
              <SocialIconButton icon={Camera} label="Photos" onClick={() => onNavigate?.('/photos')} />
            </div>
          </div>

          {/* Form Card */}
          <div
            className={cn(glassPanelClasses, 'md:col-span-7 p-6')}
            style={{ boxShadow: '0 0 20px 0 rgba(212, 165, 116, 0.15)' }}
          >
            <h2 className="text-[24px] font-bold leading-tight font-['EB_Garamond'] text-[var(--aura-chrome-bright)] mb-6">
              {t('contact.formTitle', "Send a Message")}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <FormField
                label={t('contact.formName', 'NAME')}
                placeholder="John Doe"
                value={name}
                onChange={setName}
              />
              <FormField
                label={t('contact.formEmail', 'EMAIL')}
                placeholder="john@example.com"
                type="email"
                value={email}
                onChange={setEmail}
              />
              <FormField
                label={t('contact.formMessage', 'MESSAGE')}
                placeholder={t('contact.formMessagePlaceholder', 'Your enquiry here...')}
                value={message}
                onChange={setMessage}
                multiline
              />

              <button
                type="submit"
                disabled={isSubmitting || !name || !email || !message}
                className="mt-4 bg-[var(--aura-bronze-shimmer)] text-white py-4 px-8 font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {t('contact.submit', 'DISPATCH MESSAGE')}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Map Section */}
          <div className="md:col-span-12 h-64 md:h-96 relative overflow-hidden rounded-lg"
            style={{
              border: '1px solid rgba(198,198,199,0.1)',
              backdropFilter: 'blur(24px)',
            }}
          >
            <div className="absolute top-4 left-4 z-10 bg-[var(--aura-surface-dim)]/80 p-4 border border-[var(--aura-bronze-shimmer)]/30 backdrop-blur-md rounded">
              <p className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-bronze-shimmer)]">
                {t('contact.mapLabel', 'LIVE MAP NAVIGATION')}
              </p>
              <p className="font-['Space_Grotesk'] text-[14px] leading-relaxed text-[var(--aura-chrome-bright)]">
                {t('contact.mapLocation', 'Sa Dec Industrial Park Hub')}
              </p>
            </div>

            <div
              className="w-full h-full grayscale contrast-125 brightness-75 hover:grayscale-0 transition-all duration-700 bg-cover bg-center"
              style={{
                backgroundImage:
                  'url("https://lh3.googleusercontent.com/aida-public/AB6AXuArekfgKcIZ2coS8KnTt30hWty6mPozaUNYOTXOLlu8VafNmk3Vp1cGS7pJst5AVzb2zN8LpH2AwYr6-s7d5j0AWkW64Pkq7UL80MynMT3nBk_oiDhXVE-6wKvxdFRmvdyZbzj19-HsiWc0GJS-LmD4-hX6tULQVd5INxGG2r8MwHwAH2e6WHkANKQnFQCgoHvkhWb2uxow3gB9ocsAndB5r36ruC7jC6ndrojr14roOFcyxAJiNJssBnbcMhwVskGOaakRdsC0AUI")',
              }}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-12 border-t border-white/5 flex flex-col items-center gap-2 px-6 bg-transparent">
        <div className="flex gap-4 mb-4">
          {[
            { label: t('contact.footerSupport', 'Support'), path: '/support' },
            { label: t('contact.footerPrivacy', 'Privacy Policy'), path: '/privacy' },
            { label: t('contact.footerTerms', 'Terms of Service'), path: '/terms' },
          ].map((link) => (
            <button
              key={link.label}
              onClick={() => onNavigate?.(link.path)}
              className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-chrome-soft)] hover:text-[var(--aura-chrome-bright)] transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>
        <p className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] text-[var(--aura-chrome-soft)]">
          &copy; 2024 AURA CAFE. ALL RIGHTS RESERVED.
        </p>
      </footer>
    </>
  );
}
