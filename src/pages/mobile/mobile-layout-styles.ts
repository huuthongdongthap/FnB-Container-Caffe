import type { CSSProperties } from 'react';

/* ── Layout styles ──────────────────────────────────────────────────── */

export const wrap: CSSProperties = { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--aura-noir-void)', color: 'var(--md-sys-color-on-surface)', fontFamily: 'var(--aura-font-body)' };
export const topBar: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--aura-noir-deep)', borderBottom: '1px solid var(--md-sys-color-outline-variant)', position: 'sticky', top: 0, zIndex: 10 };
export const brand: CSSProperties = { fontSize: 17, fontWeight: 700, color: 'var(--md-sys-color-primary)', letterSpacing: '-0.3px' };
export const userInfo: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
export const userName: CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--md-sys-color-on-surface)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
export const roleBadge: CSSProperties = { fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: 'var(--md-sys-color-secondary-container)', color: 'var(--md-sys-color-on-secondary-container)' };
export const logoutBtn: CSSProperties = { fontSize: 12, fontWeight: 600, padding: '6px 10px', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: 8, background: 'var(--aura-noir-mid)', color: 'var(--md-sys-color-error)', cursor: 'pointer', fontFamily: 'var(--aura-font-body)' };
export const content: CSSProperties = { flex: 1 };
export const tabBar: CSSProperties = { display: 'flex', background: 'var(--aura-noir-deep)', borderTop: '1px solid var(--md-sys-color-outline-variant)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20 };
export const tabIconWrap: CSSProperties = { width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' };

/* ── Profile styles ────────────────────────────────────────────────── */

export const PROFILE_AVATAR: CSSProperties = { width: 64, height: 64, borderRadius: '50%', background: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)', fontSize: 26, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' };
export const PROFILE_NAME: CSSProperties = { fontSize: 17, fontWeight: 700, color: 'var(--md-sys-color-on-surface)' };
export const PROFILE_ROLE: CSSProperties = { fontSize: 12, color: 'var(--md-sys-color-on-surface-variant)', textTransform: 'capitalize', marginTop: 4 };
export const PROFILE_ID: CSSProperties = { fontSize: 11, color: 'var(--md-sys-color-on-surface-variant)', marginTop: 4 };

/* ── Notification styles ───────────────────────────────────────────── */

export const NOTIF_CARD: CSSProperties = { background: 'var(--aura-noir-mid)', borderRadius: 12, padding: '12px 14px', marginBottom: 8, border: '1px solid var(--md-sys-color-outline-variant)', boxShadow: 'var(--md-sys-elevation-level1)' };
export const NOTIF_UNREAD: CSSProperties = { borderLeft: '3px solid var(--md-sys-color-primary)' };
export const NOTIF_READ: CSSProperties = { borderLeft: '3px solid var(--md-sys-color-outline-variant)' };
export const NOTIF_TITLE: CSSProperties = { fontSize: 14, fontWeight: 600, color: 'var(--md-sys-color-on-surface)' };
export const NOTIF_MSG: CSSProperties = { fontSize: 13, color: 'var(--md-sys-color-on-surface-variant)', marginTop: 3 };
export const NOTIF_TIME: CSSProperties = { fontSize: 11, color: 'var(--md-sys-color-on-surface-variant)', marginTop: 4 };
export const notifEmpty: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--md-sys-color-on-surface-variant)', textAlign: 'center', gap: 4 };
export const empty: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--md-sys-color-on-surface-variant)', fontSize: 14, textAlign: 'center' };

/* ── Factory functions ─────────────────────────────────────────────── */

export function tabStyle(active: boolean): CSSProperties {
  return {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '8px 4px 10px', cursor: 'pointer', color: active ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)', fontSize: 10,
    fontWeight: active ? 700 : 500, background: 'none', border: 'none', gap: 3, lineHeight: 1.2,
    fontFamily: 'var(--aura-font-body)',
  };
}
