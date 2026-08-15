import type { RefObject } from 'react';
import { MEMBERSHIP_IMG } from './mobile-data';

interface MobileMembershipProps {
  membershipRef: RefObject<HTMLElement | null>;
}

/**
 * Aura Membership bento card with CTA and image.
 */
export function MobileMembership({ membershipRef }: MobileMembershipProps) {
  return (
    <section ref={membershipRef} className="px-6 mt-6 mb-24">
      <div className="glass-card-reveal glass-card rounded-2xl p-6 relative overflow-hidden">
        <div
          className="absolute -top-16 -right-16 w-32 h-32 bg-[var(--aura-chrome-light)]/10 rounded-full blur-3xl -mr-16 -mt-16"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col sm:flex-row items-start gap-6">
          <div className="flex-1">
            <span className="font-body text-[10px] font-semibold tracking-[0.3em] uppercase text-[var(--aura-chrome-mid)]">
              AURA MEMBERSHIP / THÀNH VIÊN
            </span>

            <h3 className="font-display text-2xl md:text-3xl italic text-[var(--aura-chrome-bright)] mt-3 leading-snug">
              Elevate your<br />daily ritual.
            </h3>

            <p className="font-body text-sm text-[var(--aura-text-body)] mt-3 leading-relaxed max-w-xs">
              Unlock exclusive perks, early access, and rewards crafted for the discerning
              connoisseur. / Mở khóa đặc quyền, truy cập sớm, và phần thưởng dành cho người sành điệu.
            </p>

            <button
              type="button"
              className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-full text-[10px] font-body font-semibold uppercase tracking-widest text-[var(--aura-noir-deep)] hover:scale-[1.03] active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #E5E4E2, #C0C0C0)' }}
            >
              Discover More / Khám Phá
            </button>
          </div>

          <div className="w-full sm:w-1/2 aspect-square sm:aspect-auto sm:h-40 rounded-xl overflow-hidden flex-shrink-0">
            <div
              className="w-full h-full bg-cover bg-center"
              style={{ backgroundImage: `url(${MEMBERSHIP_IMG})` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
