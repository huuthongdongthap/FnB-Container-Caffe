import { labelCaps, headlineMd } from './kitchen-display-styles';
import { NAV_ITEMS } from './kitchen-display-constants';

export function KdsSideNav() {
  return (
    <aside
      className="fixed left-0 top-0 h-full z-40 flex flex-col pt-24 pb-8 px-4"
      style={{
        width: '256px',
        background: 'rgba(1, 15, 31, 0.8)',
        backdropFilter: 'blur(32px)',
        borderRight: '1px solid rgba(68, 71, 77, 0.1)',
      }}
    >
      <div className="flex items-center gap-4 px-4 mb-10">
        <div
          className="rounded-full overflow-hidden border"
          style={{
            width: '48px',
            height: '48px',
            background: 'var(--aura-noir-mid)',
            borderColor: 'rgba(68,71,77,0.3)',
          }}
        >
          <span className="flex items-center justify-center w-full h-full text-2xl">
            👨‍🍳
          </span>
        </div>
        <div className="flex flex-col">
          <span style={{ ...labelCaps, color: 'var(--aura-chrome-light)', opacity: 0.6 }}>
            STATION 01
          </span>
          <span style={{ ...headlineMd, fontSize: 16, color: 'var(--aura-chrome-bright)' }}>
            GRILL &amp; SAUTÉ
          </span>
        </div>
      </div>

      <nav className="flex flex-col gap-2 flex-grow">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.label}
            href="#"
            className="flex items-center gap-4 px-4 py-3 transition-all"
            style={{
              color: item.active ? 'var(--aura-chrome-light)' : 'var(--aura-chrome-mid)',
              borderRight: item.active ? '2px solid var(--aura-chrome-light)' : '2px solid transparent',
              background: item.active ? 'rgba(39, 54, 71, 0.2)' : 'transparent',
              opacity: item.active ? 1 : 0.6,
            }}
            onMouseEnter={(e) => {
              if (!item.active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={(e) => {
              if (!item.active) e.currentTarget.style.background = 'transparent';
            }}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span style={labelCaps}>{item.label}</span>
          </a>
        ))}
      </nav>

      <div className="px-4 mt-auto">
        <div
          className="p-4 rounded-lg"
          style={{
            background: 'var(--aura-noir-deep)',
            border: '1px solid rgba(68,71,77,0.2)',
          }}
        >
          <span
            style={{ ...labelCaps, fontSize: 11, color: 'var(--aura-chrome-light)', opacity: 0.6 }}
            className="block mb-2"
          >
            STATION LOAD
          </span>
          <div
            className="rounded-full overflow-hidden"
            style={{ height: '8px', background: 'var(--aura-noir-mid)' }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: '75%', background: 'var(--aura-chrome-light)' }}
            />
          </div>
          <span
            style={{ ...labelCaps, fontSize: 11, color: 'var(--aura-chrome-mid)', marginTop: '8px' }}
            className="block"
          >
            75% CAPACITY
          </span>
        </div>
      </div>
    </aside>
  );
}
