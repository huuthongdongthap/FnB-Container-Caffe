import { FRIENDS } from './referral-rewards-2-data';

export function FriendList() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-2">
        <h4 className="font-display text-lg text-[var(--aura-chrome-bright)]">Friend Network</h4>
        <span className="font-body text-[10px] font-semibold tracking-widest uppercase text-[var(--aura-chrome-mid)]">
          Recent Activity
        </span>
      </div>
      <div
        className="h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
          position: 'relative',
        }}
      />

      <div className="space-y-4">
        {FRIENDS.map((friend) => (
          <div
            key={friend.name}
            className="p-4 flex items-center justify-between transition-all hover:border-[var(--aura-tertiary)]/30"
            style={{
              background: 'var(--aura-noir-deep)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 overflow-hidden flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <span className="font-body text-xs font-semibold text-[var(--aura-chrome-mid)]">
                  {friend.avatar}
                </span>
              </div>
              <div>
                <p className="font-body text-sm font-medium text-[var(--aura-chrome-bright)]">
                  {friend.name}
                </p>
                <p className="font-body text-xs text-[var(--aura-chrome-mid)]">{friend.joined}</p>
              </div>
            </div>
            <span
              className="px-3 py-1 font-body text-[10px] font-semibold tracking-widest uppercase"
              style={{
                background:
                  friend.status === 'ACTIVE'
                    ? 'rgba(212,165,116,0.15)'
                    : 'rgba(255,255,255,0.05)',
                color:
                  friend.status === 'ACTIVE'
                    ? 'var(--aura-tertiary)'
                    : 'var(--aura-chrome-mid)',
                border: `1px solid ${
                  friend.status === 'ACTIVE'
                    ? 'rgba(212,165,116,0.2)'
                    : 'rgba(255,255,255,0.1)'
                }`,
              }}
            >
              {friend.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
