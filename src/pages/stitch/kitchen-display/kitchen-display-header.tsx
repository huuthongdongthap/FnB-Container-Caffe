import type { CSSProperties } from 'react';
import { fontDisplayLg, labelCaps, headlineMd, bodyMd } from './kitchen-display-styles';
import { STATUS_TABS } from './kitchen-display-constants';
import type { Ticket } from './kitchen-display-types';

interface KdsHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  activeCount: number;
}

export function KdsHeader({ activeTab, onTabChange, activeCount }: KdsHeaderProps) {
  return (
    <header
      className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 py-4"
      style={{
        background: 'rgba(5, 20, 36, 0.6)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(68, 71, 77, 0.2)',
      }}
    >
      <div className="flex items-center gap-6">
        <h1 style={{ ...fontDisplayLg, color: 'var(--aura-chrome-bright)' }}>
          HEARTH &amp; STEEL KDS
        </h1>
        <div style={{ width: '1px', height: '32px', background: 'rgba(68,71,77,0.3)' }} />
        <div className="flex flex-col">
          <span style={{ ...labelCaps, color: 'var(--aura-chrome-mid)', opacity: 0.6 }}>
            STATION
          </span>
          <span style={{ ...headlineMd, color: 'var(--aura-chrome-light)' }}>
            TERMINAL 01
          </span>
        </div>
      </div>

      <nav className="hidden md:flex items-center gap-8">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            style={{
              ...labelCaps,
              fontSize: '12px',
              color: tab === activeTab ? 'var(--aura-chrome-light)' : 'var(--aura-chrome-mid)',
              fontWeight: tab === activeTab ? '700' : '500',
              borderBottom: tab === activeTab ? '2px solid var(--aura-chrome-light)' : '2px solid transparent',
              paddingBottom: '4px',
              transition: 'all 0.2s ease',
              opacity: tab === activeTab ? 1 : 0.7,
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end">
          <span style={{ ...labelCaps, fontSize: 11, color: 'var(--aura-chrome-light)' }}>
            AVG PREP: 12M
          </span>
          <span style={{ ...bodyMd, color: 'var(--aura-chrome-mid)' }}>
            ACTIVE ORDERS: {activeCount}
          </span>
        </div>
        <div className="flex gap-3">
          <span
            className="p-2 rounded-lg transition-colors cursor-pointer"
            style={{ color: 'var(--aura-chrome-light)', opacity: 0.7 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            🔔
          </span>
          <span
            className="p-2 rounded-lg transition-colors cursor-pointer"
            style={{ color: 'var(--aura-chrome-light)', opacity: 0.7 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            ⚙️
          </span>
        </div>
      </div>
    </header>
  );
}
