import type { TableInfo } from './waiter-orders-types';

/* ── Status labels ────────────────────────────────────────────────── */

export const TABLE_STATUS_LABELS: Record<string, { vi: string; en: string }> = {
  free: { vi: 'Trống', en: 'Free' },
  occupied: { vi: 'Đang dùng', en: 'Occupied' },
  reserved: { vi: 'Đặt trước', en: 'Reserved' },
};

/* ── Static styles ──────────────────────────────────────────────────*/

export const wrap: React.CSSProperties = { minHeight: '100vh', background: 'var(--aura-noir-void)', color: 'var(--md-sys-color-on-surface)', fontFamily: 'var(--aura-font-body)', paddingBottom: 72 };
export const header: React.CSSProperties = { padding: '14px 16px', background: 'var(--aura-noir-deep)', borderBottom: '1px solid var(--md-sys-color-outline-variant)', position: 'sticky', top: 0, zIndex: 10 };
export const headerTitle: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: 'var(--md-sys-color-on-surface)', margin: 0 };
export const tabBar: React.CSSProperties = { display: 'flex', background: 'var(--aura-noir-deep)', borderBottom: '1px solid var(--md-sys-color-outline-variant)' };
export const tableGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, padding: '12px 14px' };
export const orderCard: React.CSSProperties = { margin: '8px 14px 0', background: 'var(--aura-noir-mid)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--md-sys-color-outline-variant)', boxShadow: 'var(--md-sys-elevation-level1)' };
export const empty: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--md-sys-color-on-surface-variant)', fontSize: 14 };
export const fab: React.CSSProperties = { position: 'fixed', bottom: 88, right: 18, width: 56, height: 56, borderRadius: '50%', background: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)', border: 'none', fontSize: 28, fontWeight: 300, cursor: 'pointer', boxShadow: 'var(--md-sys-elevation-level3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 };
export const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 30, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' };
export const modal: React.CSSProperties = { background: 'var(--aura-noir-mid)', color: 'var(--md-sys-color-on-surface)', borderTop: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto', padding: '20px 16px 24px' };
export const modalTitle: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: 'var(--md-sys-color-on-surface)', marginBottom: 16 };
export const formLabel: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--md-sys-color-on-surface-variant)', marginBottom: 4, marginTop: 12 };
export const formInput: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 15, border: '1.5px solid var(--md-sys-color-outline-variant)', borderRadius: 10, background: 'var(--aura-noir-void)', color: 'var(--md-sys-color-on-surface)', fontFamily: 'var(--aura-font-body)', outline: 'none' };
export const btnAdd: React.CSSProperties = { fontSize: 12, fontWeight: 600, padding: '6px 12px', border: '1.5px dashed var(--md-sys-color-primary)', borderRadius: 8, background: 'transparent', color: 'var(--md-sys-color-primary)', cursor: 'pointer', marginTop: 8, fontFamily: 'var(--aura-font-body)' };
export const btnRemove: React.CSSProperties = { fontSize: 12, color: 'var(--md-sys-color-error)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontFamily: 'var(--aura-font-body)' };
export const btnSubmit: React.CSSProperties = { width: '100%', padding: '14px 0', fontSize: 15, fontWeight: 600, border: 'none', borderRadius: 12, background: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)', cursor: 'pointer', fontFamily: 'var(--aura-font-body)', marginTop: 18 };
export const select: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 15, border: '1.5px solid var(--md-sys-color-outline-variant)', borderRadius: 10, background: 'var(--aura-noir-void)', color: 'var(--md-sys-color-on-surface)', fontFamily: 'var(--aura-font-body)', outline: 'none' };
export const orderHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 };
export const orderTable: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--md-sys-color-primary)' };
export const orderTime: React.CSSProperties = { fontSize: 11, color: 'var(--md-sys-color-on-surface-variant)' };
export const orderItem: React.CSSProperties = { fontSize: 13, color: 'var(--md-sys-color-on-surface)', padding: '2px 0' };
export const itemRow: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
export const itemFields: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap' };
export const itemNoteRow: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center' };

/* ── Column widths for item form ────────────────────────────────────*/

export const COL_NAME: React.CSSProperties = { ...formInput, flex: 2 };
export const COL_QTY: React.CSSProperties = { ...formInput, width: 60, textAlign: 'center' };
export const COL_PRICE: React.CSSProperties = { ...formInput, width: 80 };

/* ── Factory functions ──────────────────────────────────────────────*/

export function tableCardStyle(status: string): React.CSSProperties {
  const bg: Record<string, string> = {
    free: 'rgba(16, 185, 129, 0.14)',
    occupied: 'rgba(239, 68, 68, 0.14)',
    reserved: 'rgba(245, 158, 11, 0.14)',
  };
  const border: Record<string, string> = {
    free: '#10b981',
    occupied: '#ef4444',
    reserved: '#f59e0b',
  };
  return {
    background: bg[status] ?? 'var(--aura-noir-mid)',
    border: `2px solid ${border[status] ?? 'var(--md-sys-color-outline-variant)'}`,
    borderRadius: 14, padding: '18px 12px', textAlign: 'center',
  };
}

export function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '12px 0', fontSize: 13, fontWeight: active ? 700 : 500,
    textAlign: 'center', cursor: 'pointer', color: active ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
    borderBottom: active ? '2px solid var(--md-sys-color-primary)' : '2px solid transparent',
    background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
    fontFamily: 'var(--aura-font-body)', transition: 'color 0.15s',
  };
}

export function orderStatusColor(status: string): string {
  switch (status) {
    case 'pending': return '#F59E0B';
    case 'preparing': return '#3B82F6';
    case 'ready': return '#10B981';
    default: return 'var(--md-sys-color-outline-variant)';
  }
}
