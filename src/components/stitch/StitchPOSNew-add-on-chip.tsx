'use client';

import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { POSNewAddOn } from './StitchPOSNew-types';

export function AddOnChip({ addon, onAdd }: { addon: POSNewAddOn; onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onAdd}
      className="glass-card px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-[rgba(28,20,14,0.5)] transition-colors active:scale-95"
      aria-label={`${t('posNew.addOnPrefix')} ${addon.name}`}
    >
      <Plus className="w-4 h-4 text-[var(--aura-primary, #f2c08d)]" />
      <div className="text-left">
        <p className="text-[13px] text-[var(--aura-text-primary, #eae1db)] font-body">{addon.name}</p>
        <p className="text-[11px] text-[#8a7a6a] font-body">
          +${addon.price.toFixed(2)}
        </p>
      </div>
    </button>
  );
}
