import type { CSSProperties } from 'react';

/* ── Layout styles ──────────────────────────────────────────────────── */

export const wrap: CSSProperties = { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8f7f4', fontFamily: "'Space Grotesk', sans-serif" };
export const topBar: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 };
export const brand: CSSProperties = { fontSize: 17, fontWeight: 700, color: '#F97316', letterSpacing: '-0.3px' };
export const userInfo: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
export const userName: CSSProperties = { fontSize: 13, fontWeight: 600, color: '#374151', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
export const roleBadge: CSSProperties = { fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: '#fef3c7', color: '#92400e' };
export const logoutBtn: CSSProperties = { fontSize: 12, fontWeight: 600, padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#dc2626', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" };
export const content: CSSProperties = { flex: 1 };
export const tabBar: CSSProperties = { display: 'flex', background: '#ffffff', borderTop: '1px solid #e5e7eb', paddingBottom: 'env(safe-area-inset-bottom, 0px)', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20 };
export const tabIconWrap: CSSProperties = { width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' };

/* ── Profile styles ────────────────────────────────────────────────── */

export const PROFILE_AVATAR: CSSProperties = { width: 64, height: 64, borderRadius: '50%', background: '#F97316', color: '#fff', fontSize: 26, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' };
export const PROFILE_NAME: CSSProperties = { fontSize: 17, fontWeight: 700, color: '#1a1a2e' };
export const PROFILE_ROLE: CSSProperties = { fontSize: 12, color: '#6b7280', textTransform: 'capitalize', marginTop: 4 };
export const PROFILE_ID: CSSProperties = { fontSize: 11, color: '#9ca3af', marginTop: 4 };

/* ── Notification styles ───────────────────────────────────────────── */

export const NOTIF_CARD: CSSProperties = { background: '#ffffff', borderRadius: 12, padding: '12px 14px', marginBottom: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' };
export const NOTIF_UNREAD: CSSProperties = { borderLeft: '3px solid #F97316' };
export const NOTIF_READ: CSSProperties = { borderLeft: '3px solid #e5e7eb' };
export const NOTIF_TITLE: CSSProperties = { fontSize: 14, fontWeight: 600, color: '#1a1a2e' };
export const NOTIF_MSG: CSSProperties = { fontSize: 13, color: '#6b7280', marginTop: 3 };
export const NOTIF_TIME: CSSProperties = { fontSize: 11, color: '#9ca3af', marginTop: 4 };
export const notifEmpty: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', color: '#9ca3af', textAlign: 'center', gap: 4 };
export const empty: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9ca3af', fontSize: 14, textAlign: 'center' };

/* ── Factory functions ─────────────────────────────────────────────── */

export function tabStyle(active: boolean): CSSProperties {
  return {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '8px 4px 10px', cursor: 'pointer', color: active ? '#F97316' : '#9ca3af', fontSize: 10,
    fontWeight: active ? 700 : 500, background: 'none', border: 'none', gap: 3, lineHeight: 1.2,
    fontFamily: "'Space Grotesk', sans-serif",
  };
}
