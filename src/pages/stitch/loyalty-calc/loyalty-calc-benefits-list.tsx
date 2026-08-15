import type { Benefit } from './loyalty-calc-constants';

interface BenefitsListProps {
  benefits: readonly Benefit[];
}

export function BenefitsList({ benefits }: BenefitsListProps) {
  return (
    <section className="mb-8">
      <h3 className="font-label-sm text-label-sm uppercase tracking-widest text-secondary mb-4">Upcoming Rewards</h3>
      <div className="flex flex-col border-t border-secondary-container">
        {benefits.map(b => (
          <div key={b.title} className="flex items-center justify-between py-4 border-b border-secondary-container group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 flex items-center justify-center border border-secondary-container bg-[var(--aura-surface-container)]">
                <span className="text-secondary opacity-60">{b.icon}</span>
              </div>
              <div>
                <p className="font-label-md text-label-md uppercase text-on-surface">{b.title}</p>
                <p className="font-label-sm text-label-sm text-secondary opacity-60">{b.desc}</p>
              </div>
            </div>
            <span className={`material-symbols-outlined ${b.unlocked ? 'text-[var(--aura-tertiary)]' : 'text-secondary opacity-20'}`}>
              {b.unlocked ? 'lock_open' : 'lock'}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
