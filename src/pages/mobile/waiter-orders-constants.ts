import type { TableInfo } from './waiter-orders-types';

/* ── Status labels ────────────────────────────────────────────────── */

export const TABLE_STATUS_LABELS: Record<string, { vi: string; en: string }> = {
  free: { vi: 'Trống', en: 'Free' },
  occupied: { vi: 'Đang dùng', en: 'Occupied' },
  reserved: { vi: 'Đặt trước', en: 'Reserved' },
};

/* ── Static styles ──────────────────────────────────────────────────*/

export const wrap: React.CSSProperties = { minHeight: '100vh', background: '#f8f7f4', fontFamily: "'Space Grotesk', sans-serif", paddingBottom: 72 };
export const header: React.CSSProperties = { padding: '14px 16px', background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 };
export const headerTitle: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: 0 };
export const tabBar: React.CSSProperties = { display: 'flex', background: '#fff', borderBottom: '1px solid #e5e7eb' };
export const tableGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, padding: '12px 14px' };
export const orderCard: React.CSSProperties = { margin: '8px 14px 0', background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' };
export const empty: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', color: '#9ca3af', fontSize: 14 };
export const fab: React.CSSProperties = { position: 'fixed', bottom: 88, right: 18, width: 56, height: 56, borderRadius: '50%', background: '#F97316', color: '#fff', border: 'none', fontSize: 28, fontWeight: 300, cursor: 'pointer', boxShadow: '0 4px 14px rgba(249,115,22,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 };
export const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 30, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' };
export const modal: React.CSSProperties = { background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto', padding: '20px 16px 24px' };
export const modalTitle: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: '#1a1a2e', marginBottom: 16 };
export const formLabel: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4, marginTop: 12 };
export const formInput: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 15, border: '1.5px solid #e5e7eb', borderRadius: 10, background: '#f9fafb', color: '#1a1a2e', fontFamily: "'Space Grotesk', sans-serif", outline: 'none' };
export const btnAdd: React.CSSProperties = { fontSize: 12, fontWeight: 600, padding: '6px 12px', border: '1.5px dashed #F97316', borderRadius: 8, background: 'transparent', color: '#F97316', cursor: 'pointer', marginTop: 8, fontFamily: "'Space Grotesk', sans-serif" };
export const btnRemove: React.CSSProperties = { fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontFamily: "'Space Grotesk', sans-serif" };
export const btnSubmit: React.CSSProperties = { width: '100%', padding: '14px 0', fontSize: 15, fontWeight: 600, border: 'none', borderRadius: 12, background: '#F97316', color: '#fff', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", marginTop: 18 };
export const select: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 15, border: '1.5px solid #e5e7eb', borderRadius: 10, background: '#f9fafb', color: '#1a1a2e', fontFamily: "'Space Grotesk', sans-serif", outline: 'none' };
export const orderHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 };
export const orderTable: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#F97316' };
export const orderTime: React.CSSProperties = { fontSize: 11, color: '#9ca3af' };
export const orderItem: React.CSSProperties = { fontSize: 13, color: '#374151', padding: '2px 0' };
export const itemRow: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
export const itemFields: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap' };
export const itemNoteRow: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center' };

/* ── Column widths for item form ────────────────────────────────────*/

export const COL_NAME: React.CSSProperties = { ...formInput, flex: 2 };
export const COL_QTY: React.CSSProperties = { ...formInput, width: 60, textAlign: 'center' };
export const COL_PRICE: React.CSSProperties = { ...formInput, width: 80 };

/* ── Factory functions ──────────────────────────────────────────────*/

export function tableCardStyle(status: string): React.CSSProperties {
  const bg: Record<string, string> = { free: '#d1fae5', occupied: '#fee2e2', reserved: '#fef3c7' };
  const border: Record<string, string> = { free: '#6ee7b7', occupied: '#fca5a5', reserved: '#fcd34d' };
  return {
    background: bg[status] ?? '#f3f4f6',
    border: `2px solid ${border[status] ?? '#e5e7eb'}`,
    borderRadius: 14, padding: '18px 12px', textAlign: 'center',
  };
}

export function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '12px 0', fontSize: 13, fontWeight: active ? 700 : 500,
    textAlign: 'center', cursor: 'pointer', color: active ? '#F97316' : '#6b7280',
    borderBottom: active ? '2px solid #F97316' : '2px solid transparent',
    background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
    fontFamily: "'Space Grotesk', sans-serif", transition: 'color 0.15s',
  };
}

export function orderStatusColor(status: string): string {
  switch (status) {
    case 'pending': return '#fef3c7';
    case 'preparing': return '#dbeafe';
    case 'ready': return '#d1fae5';
    default: return '#f3f4f6';
  }
}
