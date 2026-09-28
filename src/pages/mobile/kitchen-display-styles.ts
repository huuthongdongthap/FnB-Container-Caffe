import React from 'react';

/* ── Static styles for OpsShell Mobile KDS (Dark Industrial Luxury) ── */

export const wrap: React.CSSProperties = {
  minHeight: '100vh',
  background: '#050814', // --aura-noir-void
  color: '#F5F5F5',
  fontFamily: 'var(--aura-font-body)',
};

export const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px',
  background: '#0A1A2E', // --aura-noir-deep
  borderBottom: '1px solid rgba(201, 214, 223, 0.15)',
  position: 'sticky',
  top: 0,
  zIndex: 10,
};

export const title: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: '#C9D6DF',
  fontFamily: 'var(--aura-font-display)',
  margin: 0,
};

export const empty: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '60vh',
  color: '#8898A4',
  fontSize: 15,
  textAlign: 'center',
  padding: 24,
};

export const card: React.CSSProperties = {
  margin: '10px 14px 0',
  background: '#0D1B2A', // --aura-noir-mid
  borderRadius: 14,
  padding: '16px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  border: '1px solid rgba(201, 214, 223, 0.15)',
};

export const cardHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
};

export const tableName: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: '#E8EEF3',
  fontFamily: 'var(--aura-font-display)',
  margin: 0,
};

export const time: React.CSSProperties = {
  fontSize: 12,
  color: '#8898A4',
};

export const itemRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  padding: '8px 0',
  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
};

export const itemName: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 500,
  color: '#F5F5F5',
  flex: 1,
};

export const itemQty: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: '#6B9FB8', // Chrome brand
  minWidth: 28,
  textAlign: 'right',
};

export const itemModifier: React.CSSProperties = {
  fontSize: 12,
  color: '#A8B8C4',
  marginTop: 2,
};

export const actions: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  marginTop: 14,
};

export const btnStart: React.CSSProperties = {
  flex: 1,
  minHeight: 52,
  padding: '12px 16px',
  fontSize: 14,
  fontWeight: 700,
  border: 'none',
  borderRadius: 12,
  cursor: 'pointer',
  background: '#2A4A7A', // Accessible blue
  color: '#FFFFFF',
  fontFamily: 'var(--aura-font-body)',
  transition: 'opacity 0.15s, transform 0.1s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const btnReady: React.CSSProperties = {
  flex: 1,
  minHeight: 52,
  padding: '12px 16px',
  fontSize: 14,
  fontWeight: 700,
  border: 'none',
  borderRadius: 12,
  cursor: 'pointer',
  background: '#4A7C59', // Forest green
  color: '#FFFFFF',
  fontFamily: 'var(--aura-font-body)',
  transition: 'opacity 0.15s, transform 0.1s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const kdsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 12,
  padding: '14px 14px',
};

export const countRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  marginTop: 4,
};

export const countBadge: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: '3px 10px',
  borderRadius: 12,
  background: 'rgba(255, 255, 255, 0.08)',
  color: '#C9D6DF',
};

export const retryBtn: React.CSSProperties = {
  marginLeft: 10,
  fontSize: 12,
  fontWeight: 600,
  background: 'none',
  border: 'none',
  color: '#EF5350',
  cursor: 'pointer',
  textDecoration: 'underline',
};

export const noOrderText: React.CSSProperties = {
  marginTop: 12,
  textAlign: 'center',
  fontSize: 13,
  fontWeight: 600,
  color: '#34D399',
};

/* ── Factory functions ─────────────────────────────────────────── */

export function statusBadgeStyle(status: string): React.CSSProperties {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: 'rgba(245, 158, 11, 0.2)', color: '#FCD34D', label: 'Chờ / Pending' },
    preparing: { bg: 'rgba(59, 130, 246, 0.2)', color: '#93C5FD', label: 'Đang làm / Preparing' },
    ready: { bg: 'rgba(16, 185, 129, 0.2)', color: '#6EE7B7', label: 'Sẵn / Ready' },
  };
  const s = map[status] ?? { bg: 'rgba(255,255,255,0.08)', color: '#C9D6DF', label: status };
  return {
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 12,
    background: s.bg,
    color: s.color,
    display: 'inline-block',
  };
}

export function cardBorder(status: string): React.CSSProperties {
  const map: Record<string, string> = {
    pending: '#F59E0B',
    preparing: '#3B82F6',
    ready: '#10B981',
  };
  return {
    ...card,
    border: `2px solid ${map[status] ?? 'rgba(201, 214, 223, 0.2)'}`,
  };
}

export function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}
