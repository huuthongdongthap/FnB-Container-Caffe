'use client';

import { useState, useCallback, useEffect } from 'react';
import { useMobileAuth } from '@/hooks/use-mobile-auth';
import { apiFetch } from '@/lib/api-client';

/* ── Types ────────────────────────────────────────────────────────── */

interface TableRow {
  id: string;
  table_number: number;
  status: 'free' | 'occupied' | 'reserved';
  capacity: number;
}

/* ── Static styles ──────────────────────────────────────────────────*/

const wrap: React.CSSProperties = { minHeight: '100vh', background: 'var(--aura-noir-void)', color: 'var(--md-sys-color-on-surface)', fontFamily: 'var(--aura-font-body)', paddingBottom: 24 };
const header: React.CSSProperties = { padding: '14px 16px', background: 'var(--aura-noir-deep)', borderBottom: '1px solid var(--md-sys-color-outline-variant)', position: 'sticky', top: 0, zIndex: 10 };
const headerTitle: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: 'var(--md-sys-color-on-surface)', margin: 0 };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, padding: '14px 14px' };
const number: React.CSSProperties = { fontSize: 26, fontWeight: 700, color: 'var(--md-sys-color-on-surface)' };
const capacity: React.CSSProperties = { fontSize: 11, color: 'var(--md-sys-color-on-surface-variant)', marginTop: 2 };
const statusBadge: React.CSSProperties = { display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: 'var(--aura-noir-deep)', color: 'var(--md-sys-color-on-surface)', marginTop: 8 };
const btns: React.CSSProperties = { display: 'flex', gap: 4, marginTop: 10, justifyContent: 'center', flexWrap: 'wrap' };
const empty: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--md-sys-color-on-surface-variant)', fontSize: 14, textAlign: 'center' };
const confirmOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 };
const confirmBox: React.CSSProperties = { background: 'var(--aura-noir-mid)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: 16, padding: '24px 20px', maxWidth: 320, width: '100%', boxShadow: 'var(--md-sys-elevation-level3)' };
const confirmText: React.CSSProperties = { fontSize: 15, color: 'var(--md-sys-color-on-surface)', textAlign: 'center', margin: 0, lineHeight: 1.5 };
const confirmBtns: React.CSSProperties = { display: 'flex', gap: 10, marginTop: 20 };
const confirmYes: React.CSSProperties = { flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600, border: 'none', borderRadius: 10, background: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)', cursor: 'pointer', fontFamily: 'var(--aura-font-body)' };
const confirmNo: React.CSSProperties = { flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600, border: '1.5px solid var(--md-sys-color-outline-variant)', borderRadius: 10, background: 'var(--aura-noir-deep)', color: 'var(--md-sys-color-on-surface-variant)', cursor: 'pointer', fontFamily: 'var(--aura-font-body)' };

/* ── Lookup maps ────────────────────────────────────────────────────*/

const STATUS_COLORS: Record<string, string> = { free: '#10b981', occupied: '#ef4444', reserved: '#f59e0b' };
const STATUS_BG: Record<string, string> = { free: 'rgba(16, 185, 129, 0.14)', occupied: 'rgba(239, 68, 68, 0.14)', reserved: 'rgba(245, 158, 11, 0.14)' };
const STATUS_BORDER: Record<string, string> = { free: '#10b981', occupied: '#ef4444', reserved: '#f59e0b' };
const STATUS_LABELS: Record<string, string> = { free: 'Trống', occupied: 'Đang dùng', reserved: 'Đặt trước' };
const STATUS_TAB_LABELS: Record<string, string> = { free: 'Trống', occupied: 'Đang dùng', reserved: 'Đặt trước' };
const STATUS_LIST: Array<{ key: string; color: string }> = [
  { key: 'free', color: '#10b981' },
  { key: 'occupied', color: '#ef4444' },
  { key: 'reserved', color: '#f59e0b' },
];

/* ── Factory functions ──────────────────────────────────────────────*/

function tableCard(status: string): React.CSSProperties {
  return {
    background: STATUS_BG[status] ?? 'var(--aura-noir-mid)',
    border: `2px solid ${STATUS_BORDER[status] ?? 'var(--md-sys-color-outline-variant)'}`,
    borderRadius: 16, padding: '18px 12px 14px', textAlign: 'center',
  };
}

function actionBtn(color: string, active: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    flex: '1 1 0', minWidth: 56, padding: '7px 4px', fontSize: 11, fontWeight: 600,
    border: `1.5px solid ${color}`, borderRadius: 8,
    fontFamily: 'var(--aura-font-body)', cursor: 'pointer',
  };
  return active ? { ...base, background: color, color: 'var(--aura-noir-void)' } : { ...base, background: 'var(--aura-noir-deep)', color };
}

/* ── Component ──────────────────────────────────────────────────────*/

export default function TableManager() {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; newStatus: string } | null>(null);

  const loadTables = useCallback(async () => {
    try {
      setError(null);
      const body = await apiFetch<{ success: boolean; tables: TableRow[] }>('/mobile/tables');
      if (body.success && body.tables) setTables(body.tables);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách bàn');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadTables(); }, [loadTables]);

  const patchStatus = useCallback(async (tableId: string, newStatus: string) => {
    try {
      setError(null);
      await apiFetch(`/mobile/tables/${tableId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, status: newStatus as TableRow['status'] } : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật trạng thái bàn thất bại');
    }
  }, []);

  const handleStatusClick = useCallback((table: TableRow, newStatus: string) => {
    if (table.status === newStatus) return;
    setConfirmTarget({ id: table.id, newStatus });
  }, []);

  const confirmChange = useCallback(() => {
    if (!confirmTarget) return;
    patchStatus(confirmTarget.id, confirmTarget.newStatus);
    setConfirmTarget(null);
  }, [confirmTarget, patchStatus]);

  const handleConfirmKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setConfirmTarget(null);
  }, []);

  return (
    <div style={wrap}>
      <div style={header}>
        <h1 style={headerTitle}>Quản lý bàn / Tables</h1>
      </div>

      {loading && tables.length === 0 && <div style={empty}>Đang tải... / Loading...</div>}

      {!loading && tables.length === 0 && (
        <div style={empty}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🪑</div>
          <div>Không có bàn / No tables found</div>
        </div>
      )}

      <div style={grid}>
        {tables.map((table) => (
          <div key={table.id} style={tableCard(table.status)}>
            <div style={number}>Bàn {table.table_number}</div>
            <div style={capacity}>{table.capacity} chỗ / seats</div>
            <div style={statusBadge}>{STATUS_LABELS[table.status]}</div>
            <div style={btns}>
              {STATUS_LIST.map(({ key, color }) => (
                <button key={key}
                  style={actionBtn(color, table.status === key)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleStatusClick(table, key)}>
                  {STATUS_TAB_LABELS[key]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {confirmTarget && (
        <div style={confirmOverlay} onClick={() => setConfirmTarget(null)}>
          <div style={confirmBox} role="dialog" aria-label="Confirm status change" onClick={(e) => e.stopPropagation()} onKeyDown={handleConfirmKeyDown}>
            <p style={confirmText}><strong>Đổi trạng thái bàn?</strong><br />Change table status?</p>
            <div style={confirmBtns}>
              <button style={confirmNo} onClick={() => setConfirmTarget(null)}>Hủy / Cancel</button>
              <button style={confirmYes} onClick={confirmChange}>Xác nhận / Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
