'use client';

import { useState, useEffect, useCallback } from 'react';
import { offlineDb } from '@/lib/offline-db';

/* ── Types ────────────────────────────────────────────────────────── */

interface QueueItem {
  id: string;
  action: string;
  endpoint: string;
  payload?: string;
  created_at: string;
}

/* Mirrors OfflineOrderRecord shape from offline-db.ts */
interface OfflineOrderRecord {
  localId: string;
  orderData: Record<string, unknown>;
  createdAt: number;
  synced: boolean;
}

/* ── Static styles ──────────────────────────────────────────────────*/

const wrap: React.CSSProperties = { minHeight: '100vh', background: '#f8f7f4', fontFamily: "'Space Grotesk', sans-serif", paddingBottom: 24 };
const header: React.CSSProperties = { padding: '14px 16px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const headerTitle: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: 0 };
const statusText: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#6b7280' };
const list: React.CSSProperties = { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 };
const listCard: React.CSSProperties = { background: '#ffffff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: 5 };
const endpointText: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: '#1a1a2e', wordBreak: 'break-all', marginTop: 3 };
const timeText: React.CSSProperties = { fontSize: 11, color: '#9ca3af', marginTop: 2 };
const btnSync: React.CSSProperties = { margin: '8px 14px 0', padding: '14px 0', fontSize: 15, fontWeight: 600, border: 'none', borderRadius: 12, background: '#F97316', color: '#fff', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", transition: 'opacity 0.15s' };
const empty: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9ca3af', fontSize: 14, textAlign: 'center' };
const payloadPre: React.CSSProperties = { fontSize: 11, background: '#f9fafb', padding: '8px 10px', borderRadius: 6, marginTop: 4, overflow: 'auto', maxHeight: 80, color: '#374151' };

/* ── Factory functions ──────────────────────────────────────────────*/

function statusDotColor(online: boolean): React.CSSProperties {
  return {
    width: 9, height: 9, borderRadius: '50%',
    background: online ? '#10b981' : '#ef4444',
    display: 'inline-block',
    boxShadow: `0 0 6px ${online ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'}`,
  };
}

function methodBadge(method: string): React.CSSProperties {
  const colors: Record<string, string> = { POST: '#3b82f6', PATCH: '#f59e0b', GET: '#10b981', DELETE: '#ef4444' };
  return {
    display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
    background: colors[method] ?? '#6b7280', color: '#fff', letterSpacing: '0.05em', alignSelf: 'flex-start',
  };
}

/* ── Component ──────────────────────────────────────────────────────*/

export default function OfflineQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  const loadQueue = useCallback(async () => {
    try {
      const records = await offlineDb.getPendingOrders();
      // getPendingOrders returns object[], cast to OfflineOrderRecord
      const typed = records as OfflineOrderRecord[];
      const mapped = typed
        .map((r) => {
          const data = r.orderData as Record<string, unknown>;
          const rawUrl = (data.url as string) ?? (data.endpoint as string) ?? '';
          const endpoint = rawUrl.replace(/^https?:\/\/[^/]+/, '') || '/';
          const method = ((data.method as string) ?? 'POST').toUpperCase();
          return {
            id: r.localId,
            action: method as QueueItem['action'],
            endpoint,
            payload: (data.body as string) ?? (data.payload as string) ?? '',
            created_at: new Date(r.createdAt).toISOString(),
          };
        })
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      setQueue(mapped);
    } catch {
      setQueue([]);
    }
  }, []);

  useEffect(() => {
    loadQueue();
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [loadQueue]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const records = await offlineDb.getPendingOrders();
      const typed = records as OfflineOrderRecord[];
      for (const rec of typed) {
        const data = rec.orderData as Record<string, unknown>;
        const rawUrl = (data.url as string) ?? (data.endpoint as string) ?? '';
        const url = rawUrl.replace(/^https?:\/\/[^/]+/, '') || '/';
        const method = ((data.method as string) ?? 'POST').toUpperCase();
        try {
          const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: (data.body as string) ?? '{}' });
          if (res.ok || res.status < 500) await offlineDb.removeOrder(rec.localId);
        } catch { /* keep in queue */ }
      }
      await loadQueue();
    } catch { /* silent */ } finally { setSyncing(false); }
  }, [loadQueue]);

  const formatTime = (iso: string): string => {
    try {
      return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div style={wrap}>
      <div style={header}>
        <h1 style={headerTitle}>Hàng chờ / Offline Queue</h1>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={statusText}>{isOnline ? 'Online' : 'Offline'}</span>
          <span style={statusDotColor(isOnline)} />
        </div>
      </div>

      {queue.length === 0 ? (
        <div style={empty}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
          <div>Không có hàng chờ</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Queue empty</div>
        </div>
      ) : (
        <div style={list}>
          {queue.map((item) => (
            <div key={item.id} style={listCard}>
              <span style={methodBadge(item.action)}>{item.action}</span>
              <div style={endpointText}>{item.endpoint}</div>
              <div style={timeText}>{formatTime(item.created_at)}</div>
              {item.payload && (
                <details style={{ marginTop: 4 }}>
                  <summary style={{ fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>Payload / Xem nội dung</summary>
                  <pre style={payloadPre}>{item.payload}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {queue.length > 0 && (
        <button
          style={{ ...btnSync, opacity: syncing || !isOnline ? 0.6 : 1 }}
          disabled={syncing || !isOnline}
          onClick={handleSync}
        >
          {syncing ? 'Đang đồng bộ...' : `Đồng bộ / Sync Now (${queue.length})`}
        </button>
      )}
    </div>
  );
}
