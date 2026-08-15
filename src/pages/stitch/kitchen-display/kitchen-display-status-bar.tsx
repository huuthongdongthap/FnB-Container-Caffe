import { labelCaps } from './kitchen-display-styles';

export function KdsStatusBar() {
  return (
    <div
      className="mb-8 flex items-center justify-between"
      style={{ borderBottom: '1px solid rgba(68,71,77,0.1)', paddingBottom: '16px' }}
    >
      <div className="flex gap-4">
        <span
          className="px-3 py-1 rounded-full flex items-center gap-2"
          style={{
            ...labelCaps,
            fontSize: 11,
            background: 'rgba(100, 66, 26, 0.4)',
            color: '#dfaf7e',
            border: '1px solid rgba(223, 175, 126, 0.3)',
          }}
        >
          <span
            className="rounded-full animate-pulse"
            style={{ width: '8px', height: '8px', background: '#efbd8a' }}
          />
          PREPARING (4)
        </span>
        <span
          className="px-3 py-1 rounded-full"
          style={{
            ...labelCaps,
            fontSize: 11,
            background: 'rgba(39, 54, 71, 0.4)',
            color: 'var(--aura-chrome-mid)',
          }}
        >
          PENDING (6)
        </span>
        <span
          className="px-3 py-1 rounded-full"
          style={{
            ...labelCaps,
            fontSize: 11,
            background: 'rgba(0, 26, 56, 0.5)',
            color: '#6984ad',
          }}
        >
          READY (2)
        </span>
      </div>
      <span style={{ ...labelCaps, fontSize: 11, color: 'var(--aura-chrome-mid)' }}>
        AURA CAFE • REVENUE CENTER: BAR
      </span>
    </div>
  );
}
