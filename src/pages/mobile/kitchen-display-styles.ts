import React from 'react';

/* ── Static styles ──────────────────────────────────────────────── */

export const wrap: React.CSSProperties = { minHeight: '100vh', background: '#f3f4f6', fontFamily: "'Space Grotesk', sans-serif" };
export const header: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 };
export const title: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: 0 };
export const empty: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9ca3af', fontSize: 15, textAlign: 'center', padding: 24 };
export const card: React.CSSProperties = { margin: '10px 14px 0', background: '#ffffff', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0' };
export const cardHeader: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 };
export const tableName: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: '#1a1a2e', margin: 0 };
export const time: React.CSSProperties = { fontSize: 12, color: '#9ca3af' };
export const itemRow: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6' };
export const itemName: React.CSSProperties = { fontSize: 14, color: '#374151', flex: 1 };
export const itemQty: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: '#F97316', minWidth: 28, textAlign: 'right' };
export const itemModifier: React.CSSProperties = { fontSize: 12, color: '#6b7280' };
export const actions: React.CSSProperties = { display: 'flex', gap: 8, marginTop: 12 };
export const btnStart: React.CSSProperties = { flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 10, cursor: 'pointer', background: '#3b82f6', color: '#fff', fontFamily: "'Space Grotesk', sans-serif", transition: 'opacity 0.15s' };
export const btnReady: React.CSSProperties = { flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 10, cursor: 'pointer', background: '#10b981', color: '#fff', fontFamily: "'Space Grotesk', sans-serif", transition: 'opacity 0.15s' };
export const kdsGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, padding: '14px 14px' };
export const countRow: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 };
export const countBadge: React.CSSProperties = { fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12 };
export const retryBtn: React.CSSProperties = { marginLeft: 10, fontSize: 12, fontWeight: 600, background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', textDecoration: 'underline' };
export const noOrderText: React.CSSProperties = { marginTop: 12, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#10b981' };

/* ── Factory functions ─────────────────────────────────────────── */

export function statusBadgeStyle(status: string): React.CSSProperties {
  const map: Record<string, { bg: string; label: string }> = {
    pending: { bg: '#fef3c7', label: 'Chờ / Pending' },
    preparing: { bg: '#dbeafe', label: 'Đang làm / Preparing' },
    ready: { bg: '#d1fae5', label: 'Sẵn / Ready' },
  };
  const s = map[status] ?? { bg: '#f3f4f6', label: status };
  return { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: s.bg, color: '#374151', display: 'inline-block' };
}

export function cardBorder(status: string): React.CSSProperties {
  const map: Record<string, string> = { pending: '#F97316', preparing: '#3b82f6', ready: '#10b981' };
  return { ...card, border: `2px solid ${map[status] ?? '#e5e7eb'}` };
}

export function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}
