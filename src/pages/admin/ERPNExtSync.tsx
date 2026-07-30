import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdmin } from '@/hooks/use-admin';
import { SyncStatus } from '@/components/admin/SyncStatus';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { API_BASE } from '@/lib/api-client';


interface SyncLogEntry {
  id: string;
  entity: string;
  action: string;
  status: 'success' | 'error';
  message: string;
  timestamp: string;
}

const SYNC_ENTITIES = ['Orders', 'Products', 'Customers', 'Inventory', 'Invoices'];

export default function AdminERPNExtSyncPage() {
  const { t } = useTranslation('erpnextSync');
  const { syncStatus, isLoadingSyncStatus } = useAdmin();
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([
    { id: 'L001', entity: 'Orders', action: 'sync', status: 'success', message: t('mockSyncedOrders'), timestamp: new Date(Date.now() - 300000).toISOString() },
    { id: 'L002', entity: 'Products', action: 'sync', status: 'success', message: t('mockSyncedProducts'), timestamp: new Date(Date.now() - 600000).toISOString() },
    { id: 'L003', entity: 'Customers', action: 'sync', status: 'error', message: t('mockConnectionFailed'), timestamp: new Date(Date.now() - 900000).toISOString() },
    { id: 'L004', entity: 'Inventory', action: 'sync', status: 'success', message: t('mockInventoryUpdated'), timestamp: new Date(Date.now() - 3600000).toISOString() },
  ]);
  const [syncingEntity, setSyncingEntity] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const triggerSync = async (entity: string) => {
    const { token } = useAuthStore.getState();
    if (!token) return;

    setSyncingEntity(entity);
    try {
      const res = await fetch(`${API_BASE}/api/admin/erpnext-sync/${entity.toLowerCase()}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const body = res.ok ? await res.json().catch(() => ({})) : null;

      const logEntry: SyncLogEntry = {
        id: `L${Date.now()}`,
        entity,
        action: 'sync',
        status: res.ok ? 'success' : 'error',
        message: res.ok
          ? t('syncSuccess', { entity })
          : (body?.message || t('syncError', { entity })),
        timestamp: new Date().toISOString(),
      };
      setSyncLogs((prev) => [logEntry, ...prev]);
    } catch {
      setSyncLogs((prev) => [
        {
          id: `L${Date.now()}`,
          entity,
          action: 'sync',
          status: 'error',
          message: t('syncConnectionError', { entity }),
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    } finally {
      setSyncingEntity(null);
    }
  };

  const handleSyncAll = async () => {
    const { token } = useAuthStore.getState();
    if (!token) return;

    setSyncingAll(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/erpnext-sync/sync-all`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const body = res.ok ? await res.json().catch(() => ({})) : null;

      setSyncLogs((prev) => [
        {
          id: `L${Date.now()}`,
          entity: 'All',
          action: 'sync-all',
          status: res.ok ? 'success' : 'error',
          message: res.ok
            ? t('syncAllSuccess')
            : (body?.message || t('syncAllError')),
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch {
      setSyncLogs((prev) => [
        {
          id: `L${Date.now()}`,
          entity: 'All',
          action: 'sync-all',
          status: 'error',
          message: t('syncAllConnectionError'),
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <>
      <HelmetHead
        title="Đồng bộ ERPNext — ERPNext Sync — AURA CAFE"
        description="Đồng bộ dữ liệu đơn hàng, sản phẩm, khách hàng với ERPNext tại AURA CAFE. Sync orders, products & customers with ERPNext."
      />
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-display font-bold">{t('syncTitle')}</h1>
          <Button onClick={handleSyncAll} loading={syncingAll} disabled={syncingAll}>
            &#8635; {t('syncAll')}
          </Button>
        </div>

        {/* Status */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="font-display font-semibold">{t('syncStatusTitle')}</h2>
          </CardHeader>
          <CardBody>
            <SyncStatus status={syncStatus} isLoading={isLoadingSyncStatus} />
          </CardBody>
        </Card>

        {/* Entity sync controls */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="font-display font-semibold">{t('syncByEntity')}</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SYNC_ENTITIES.map((entity) => (
                <div
                  key={entity}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-white"
                >
                  <div>
                    <p className="text-sm font-medium">{entity}</p>
                    <p className="text-xs text-muted">
                      {syncLogs
                        .filter((l) => l.entity === entity)
                        .slice(0, 1)
                        .map((l) => `${l.status === 'success' ? t('lastSuccess') : t('lastError')}`)
                        .join('') || t('notSynced')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    loading={syncingEntity === entity}
                    disabled={syncingEntity === entity}
                    onClick={() => triggerSync(entity)}
                  >
                    &#8635; {t('sync')}
                  </Button>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Sync logs */}
        <Card>
          <CardHeader>
            <h2 className="font-display font-semibold">{t('syncLogsTitle')}</h2>
          </CardHeader>
          <CardBody>
            {syncLogs.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">{t('noSyncHistory')}</p>
            ) : (
              <div className="space-y-2">
                {syncLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/10 text-sm"
                  >
                    <Badge variant={log.status === 'success' ? 'success' : 'destructive'}>
                      {log.status === 'success' ? t('badgeOk') : t('badgeErr')}
                    </Badge>
                    <div className="flex-1">
                      <p className="font-medium text-xs">
                        {log.entity} &mdash; {log.action}
                      </p>
                      <p className="text-xs text-muted">{log.message}</p>
                    </div>
                    <span className="text-xs text-muted shrink-0">
                      {formatRelativeTime(t, log.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
    </>
  );
}

function formatRelativeTime(t: (key: string, params?: Record<string, string | number>) => string, iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t('justNow');
  if (minutes < 60) return t('minutesAgo', { minutes });
  const hours = Math.floor(minutes / 60);
  return t('hoursAgo', { hours });
}
