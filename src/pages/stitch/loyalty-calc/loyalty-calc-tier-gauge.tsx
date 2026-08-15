import { TIER_LABELS } from './loyalty-calc-constants';

interface TierGaugeProps {
  points: number;
  currentTier: string;
  activeNodes: readonly string[];
  pct: number;
}

export function TierGauge({ points, currentTier, activeNodes, pct }: TierGaugeProps) {
  return (
    <section className="mb-8">
      <div className="flex justify-between items-end mb-2">
        <h3 className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">Tier Status</h3>
        <span className="font-label-md text-label-md text-[var(--aura-tertiary)]">{currentTier}</span>
      </div>
      <div className="gauge-track mb-1">
        <div className="gauge-fill" id="gauge-fill" style={{ width: `${pct}%` }} />
        {TIER_LABELS.map((t, i) => (
          <div
            key={t}
            className={`gauge-node ${activeNodes.includes(t) ? 'active' : ''}`}
            style={{ left: `${(i / (TIER_LABELS.length - 1)) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        {TIER_LABELS.map(t => (
          <span
            key={t}
            className={`font-label-sm text-label-sm ${t === currentTier ? 'text-[var(--aura-tertiary)]' : 'text-secondary opacity-40'}`}
          >
            {t}
          </span>
        ))}
      </div>

      <style>{`
        .gauge-track {
          height: 2px;
          background: #2E3A4C;
          position: relative;
        }
        .gauge-fill {
          height: 100%;
          background: #D4A574;
          transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .gauge-node {
          width: 8px;
          height: 8px;
          background: #121F31;
          border: 1px solid #2E3A4C;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          border-radius: 50%;
        }
        .gauge-node.active {
          border-color: #D4A574;
          background: #D4A574;
          box-shadow: 0 0 10px rgba(212, 165, 116, 0.4);
        }
      `}</style>
    </section>
  );
}
