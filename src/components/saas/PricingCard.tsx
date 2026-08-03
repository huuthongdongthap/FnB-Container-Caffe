'use client';

import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface PricingTier {
  id: string;
  slug: string;
  nameVi: string;
  nameEn: string;
  descriptionVi: string | null;
  descriptionEn: string | null;
  priceVnd: number;
  priceUsd: number | null;
  currency: string;
  billingPeriod: string;
  sortOrder: number;
  isRecommended: boolean;
  featuresVi: string[];
  featuresEn: string[];
  ctaTextVi: string;
  ctaTextEn: string;
  ctaLink: string;
}

type Props = {
  tier: PricingTier;
  locale: string;
};

export default function PricingCard({ tier, locale }: Props): ReactNode {
  const navigate = useNavigate();
  const isVi = locale === 'vi';

  const name = isVi ? tier.nameVi : tier.nameEn;
  const description = isVi ? tier.descriptionVi : tier.descriptionEn;
  const features = isVi ? tier.featuresVi : tier.featuresEn;
  const cta = isVi ? tier.ctaTextVi : tier.ctaTextEn;

  const handleClick = () => {
    navigate(`/${locale}${tier.ctaLink}`);
  };

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${
        tier.isRecommended
          ? 'border-[#d4a853] bg-gradient-to-b from-[#2e1e0a] to-[#1a1207] shadow-[#d4a853]/20'
          : 'border-[#2e1e0a] bg-[#1a1207] hover:border-[#4a3520]'
      }`}
    >
      {tier.isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-[#d4a853] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#0f0a04]">
            {isVi ? 'Đề xuất' : 'Recommended'}
          </Badge>
        </div>
      )}

      <div className="mb-6">
        <h3 className="font-heading text-xl font-bold text-[#f5e6c8]">{name}</h3>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-[#c4a882]">{description}</p>
        )}
      </div>

      <div className="mb-6">
        <span className="font-heading text-4xl font-bold text-[#f5e6c8]">
          {tier.priceVnd.toLocaleString('vi-VN')}
        </span>
        <span className="ml-1 text-sm text-[#8a7560]">₫</span>
        <p className="mt-1 text-xs text-[#8a7560]">
          {tier.billingPeriod === 'yearly' ? '/ năm' : '/ tháng'}
        </p>
      </div>

      <ul className="mb-8 flex-1 space-y-3">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-[#c4a882]">
            <span className="mt-0.5 inline-block h-4 w-4 shrink-0 text-[#d4a853]">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Button
        onClick={handleClick}
        className={`w-full py-3 text-sm font-semibold transition-all ${
          tier.isRecommended
            ? 'bg-[#d4a853] text-[#0f0a04] hover:bg-[#e0b85e]'
            : 'border border-[#4a3520] bg-transparent text-[#c4a882] hover:border-[#d4a853] hover:text-[#f5e6c8]'
        }`}
      >
        {cta}
      </Button>
    </div>
  );
}
