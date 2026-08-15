/**
 * StitchContactNew — Contact info card section
 */
'use client';

import { useTranslation } from 'react-i18next';
import { Share2, ThumbsUp, Camera } from 'lucide-react';
import { cn } from '@/lib/cn';
import { glassPanelClasses } from './StitchContactNew-constants';
import { SocialIconButton } from './StitchContactNew-social-icon';

export function ContactInfoCard({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { t } = useTranslation();

  return (
    <div className={cn(glassPanelClasses, 'md:col-span-5 p-6 flex flex-col gap-6')}>
      <div>
        <h3 className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-bronze-shimmer)] mb-2">
          {t('contact.address', 'ADDRESS')}
        </h3>
        <p className="font-['Space_Grotesk'] text-[18px] leading-relaxed text-[var(--aura-text-primary)]">
          39 Nguyen Tat Than, Sa Dec,<br />
          Dong Thap, Vietnam
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

      <div className="mt-auto pt-6 flex gap-4">
        <SocialIconButton icon={Share2} label="Share" onClick={() => onNavigate?.('/share')} />
        <SocialIconButton icon={ThumbsUp} label="Like" onClick={() => onNavigate?.('/social')} />
        <SocialIconButton icon={Camera} label="Photos" onClick={() => onNavigate?.('/photos')} />
      </div>
    </div>
  );
}
