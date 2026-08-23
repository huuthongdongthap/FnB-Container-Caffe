'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePosCustomerLookup, type POSCustomer } from '@/hooks/use-pos-customer';
import { Search, X, UserCheck } from 'lucide-react';

interface CustomerLookupProps {
  /** Currently identified customer (null when no customer selected) */
  customer: POSCustomer | null;
  /** Called when a customer is successfully identified */
  onCustomerFound?: (customer: POSCustomer) => void;
  /** Called when the cashier clears the customer */
  onClearCustomer?: () => void;
}

/* Tier badge color mapping — module-level to avoid per-render allocation */
const TIER_COLORS: Record<string, string> = {
  bronze: 'bg-[#cd7f32]/20 text-[#cd7f32]',
  silver: 'bg-[#c0c0c0]/20 text-[#c0c0c0]',
  gold: 'bg-[#ffd700]/20 text-[#ffd700]',
  platinum: 'bg-[#e5e4e2]/20 text-[#e5e4e2]',
};

export function CustomerLookup({
  customer,
  onCustomerFound,
  onClearCustomer,
}: CustomerLookupProps) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const lookupMutation = usePosCustomerLookup();

  const handleLookup = () => {
    const trimmed = phone.trim();
    if (!trimmed || trimmed.length < 8) return;
    lookupMutation.mutate(trimmed, {
      onSuccess: (res) => {
        if (res.found && res.customer) {
          onCustomerFound?.(res.customer);
        } else {
          onClearCustomer?.();
        }
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLookup();
  };

  /* ── Identified customer badge ────────────────────────────────────── */
  if (customer) {
    const tierClass = TIER_COLORS[customer.loyalty_tier] || TIER_COLORS.bronze;

    return (
      <div className="px-6 py-3 border-b border-[rgba(242,192,141,0.08)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-[12px] text-emerald-400 uppercase tracking-wide font-body font-semibold">
              {t('posNew.customerFound')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => { onClearCustomer?.(); setPhone(''); }}
            className="text-[#8a7a6a] hover:text-[var(--aura-text-primary, #eae1db)] transition-colors cursor-pointer"
            aria-label={t('posNew.clearCustomer')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[14px] text-[var(--aura-text-primary, #eae1db)] font-body font-semibold truncate">
          {customer.name}
        </p>
        <p className="text-[12px] text-[#8a7a6a] font-body mt-0.5">{customer.phone}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-[11px] px-2 py-0.5 rounded-sm font-body uppercase tracking-wide ${tierClass}`}>
            {customer.loyalty_tier_label}
          </span>
          <span className="text-[11px] text-[var(--aura-primary, #f2c08d)] font-body">
            {customer.loyalty_points} {t('posNew.loyaltyPoints')}
          </span>
        </div>
        <div className="flex gap-3 mt-1.5">
          <span className="text-[11px] text-[#8a7a6a] font-body">
            {t('posNew.cashbackBalance')}: {customer.cashback_balance.toLocaleString()}
          </span>
          <span className="text-[11px] text-[#8a7a6a] font-body">
            {t('posNew.visitCount')}: {customer.visit_count}
          </span>
        </div>
      </div>
    );
  }

  /* ── Phone lookup input ──────────────────────────────────────────── */
  return (
    <div className="px-6 py-3 border-b border-[rgba(242,192,141,0.08)]">
      <p className="text-[11px] text-[#8a7a6a] uppercase tracking-wide font-body mb-2">
        {t('posNew.lookupCustomer')}
      </p>
      <div className="flex gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('posNew.phonePlaceholder')}
          className="flex-1 bg-[rgba(242,192,141,0.05)] border border-[rgba(242,192,141,0.12)] rounded-sm px-3 py-2 text-[13px] text-[var(--aura-text-primary, #eae1db)] placeholder:text-[#5a4a3a] font-body outline-none focus:border-[rgba(242,192,141,0.3)] transition-colors"
        />
        <button
          type="button"
          onClick={handleLookup}
          disabled={!phone.trim() || lookupMutation.isPending}
          className="px-4 py-2 bg-[rgba(242,192,141,0.1)] border border-[rgba(242,192,141,0.2)] rounded-sm text-[var(--aura-primary, #f2c08d)] active:scale-95 transition-transform disabled:opacity-40 cursor-pointer"
          aria-label={t('posNew.lookupBtn')}
        >
          <Search className="w-4 h-4" />
        </button>
      </div>
      {lookupMutation.isError && (
        <p className="text-[11px] text-[#ff6b6b] mt-1.5 font-body">
          {lookupMutation.error?.message || t('posNew.phoneInvalid')}
        </p>
      )}
      {lookupMutation.isSuccess && lookupMutation.data && !lookupMutation.data.found && (
        <p className="text-[11px] text-[#8a7a6a] mt-1.5 font-body">
          {lookupMutation.data.message || t('posNew.customerNotFound')}
        </p>
      )}
    </div>
  );
}
