import { ORDERS } from './account-constants';

export function RecentTransactions() {
  return (
    <section>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-display text-xl text-[var(--aura-chrome-bright)]">
          Giao dịch gần đây
        </h3>
        <button
          type="button"
          className="font-body text-[10px] font-bold uppercase tracking-widest text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
        >
          Tất cả / VIEW ALL
        </button>
      </div>

      <div className="space-y-3">
        {ORDERS.map((order) => (
          <div
            key={order.name}
            className="glass-card flex items-center gap-4 p-4"
            style={{ boxShadow: 'inset 0 1px 0 0 rgba(205,127,50,0.15)' }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: 'var(--aura-surface-container-high)' }}
            >
              {order.icon}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-body text-[15px] font-semibold text-[var(--aura-chrome-bright)] truncate">
                {order.name}
              </p>
              <span className="block label-caps text-[10px] text-[var(--aura-chrome-mid)] mt-[2px]">
                {order.time}
              </span>
            </div>

            <span
              className={`font-body text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full flex-shrink-0 ${
                order.statusVariant === 'delivered'
                  ? 'bg-white/5 text-[var(--aura-chrome-mid)] border border-white/10'
                  : 'bg-[var(--aura-chrome-mid)]/10 text-[var(--aura-chrome-mid)] border border-[var(--aura-chrome-mid)]/20'
              }`}
            >
              {order.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
