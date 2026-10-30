'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button as _Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PricingCard, { type PricingTier } from '@/components/saas/PricingCard';
import { apiFetch } from '@/lib/api-client';

const SUPPORTED_LOCALES = new Set(['vi', 'en']);

export default function PricingPage(): ReactNode {
  const { locale: paramLocale } = useParams<{ locale: string }>();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);

  const fallbackLocale = SUPPORTED_LOCALES.has(i18n.resolvedLanguage ?? '')
    ? (i18n.resolvedLanguage as string)
    : SUPPORTED_LOCALES.has(i18n.language?.slice(0, 2) ?? '')
      ? (i18n.language.slice(0, 2) as string)
      : 'vi';
  const locale = paramLocale && SUPPORTED_LOCALES.has(paramLocale) ? paramLocale : fallbackLocale;

  useEffect(() => {
    if (paramLocale && !SUPPORTED_LOCALES.has(paramLocale)) {
      navigate('/pricing', { replace: true });
      return;
    }
    if (paramLocale && SUPPORTED_LOCALES.has(paramLocale) && i18n.resolvedLanguage !== paramLocale) {
      void i18n.changeLanguage(paramLocale).catch(() => {});
    }
  }, [paramLocale, i18n, navigate]);

  useEffect(() => {
    if (paramLocale && !SUPPORTED_LOCALES.has(paramLocale)) return;

    apiFetch<{ ok?: boolean; success?: boolean; data?: PricingTier[] }>('/api/saas/pricing', {
      headers: { 'Accept-Language': locale },
      silent: true,
    })
      .then((json) => {
        if (json.ok || json.success) setTiers(json.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locale, paramLocale]);

  if (paramLocale && !SUPPORTED_LOCALES.has(paramLocale)) {
    return null;
  }

  const isVi = locale === 'vi';

  return (
    <div className="min-h-screen bg-[#1a1207]">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-[#2e1e0a]">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2e1e0a]/40 to-transparent" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center">
          <Badge variant="outline" className="mb-6 border-[#d4a853]/60 bg-[#2e1e0a] text-xs uppercase tracking-widest text-[#d4a853]">
            {isVi ? 'Gói dịch vụ' : 'Pricing Plans'}
          </Badge>
          <h1 className="font-heading text-4xl font-bold tracking-tight text-[#f5e6c8] md:text-5xl">
            {isVi ? 'Chọn gói phù hợp với bạn' : 'Choose your plan'}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-[#c4a882]">
            {isVi
              ? 'Từ startup solo đến doanh nghiệp — mọi gói đều có 14 ngày dùng thử miễn phí.'
              : 'From solo startup to enterprise — every plan includes a 14-day free trial.'}
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d4a853] border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {tiers.map((tier) => (
              <PricingCard key={tier.id} tier={tier} locale={locale} />
            ))}
          </div>
        )}

        {!loading && tiers.length === 0 && (
          <p className="py-20 text-center text-[#c4a882]">
            {isVi ? 'Chưa có gói dịch vụ nào.' : 'No pricing plans available.'}
          </p>
        )}
      </section>

      {/* Trust Section */}
      <section className="border-t border-[#2e1e0a] bg-[#0f0a04]">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center">
          <p className="text-sm text-[#8a7560]">
            {isVi
              ? '🔒 Thanh toán an toàn • Không hợp đồng dài hạn • Hủy bất cứ lúc nào'
              : '🔒 Secure payment • No long-term contract • Cancel anytime'}
          </p>
        </div>
      </section>
    </div>
  );
}
