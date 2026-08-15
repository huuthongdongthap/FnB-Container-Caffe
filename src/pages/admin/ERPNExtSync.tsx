import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdmin } from '@/hooks/use-admin';
import { SyncStatus } from '@/components/admin/SyncStatus';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { apiFetch } from '@/lib/api-client';
import { SYNC_ENTITIES } from './erpnext-sync-types';
import type { SyncLogEntry } from './erpnext-sync-types';
import { SyncEntityCard } from './sync-entity-card';
import { SyncLogList } from './sync-log-list';

const MOCK_LOGS: SyncLogEntry[] = [
  { id: 'L001', entity: 'Orders', action: 'sync', status: 'success', message: 'mockSyncedOrders', timestamp: new Date(Date.now() - 300000).toISOString() },
  { id: 'L002', entity: 'Products', action: 'sync', status: 'success', message: 'mockSyncedProducts', timestamp: new Date(Date.now() - 600000).toISOString() },
  { id: 'L003', entity: 'Customers', action: 'sync', status: 'error', message: 'mockConnectionFailed', timestamp: new Date(Date.now() - 900000).toISOString() },
  { id: 'L004', entity: 'Inventory', action: 'sync', status: 'success', message: 'mockInventoryUpdated', timestamp: new Date(Date.now() - 3600000).toISOString() },
];

export default function AdminERPNExtSyncPage() {
  const { t } = useTranslation('erpnextSync');
  const { syncStatus, isLoadingSyncStatus } = useAdmin();
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>(
    MOCK_LOGS.map((log) => ({ ...log, message: t(log.message) }))
  );
  const [syncingEntity, setSyncingEntity] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const appendLog = (entry: Omit<SyncLogEntry, 'id' | 'timestamp'>) => {
    setSyncLogs((prev) => [
      { ...entry, id: `L${Date.now()}`, timestamp: new Date().toISOString() },
      ...prev,
    ]);
  };

  const triggerSync = async (entity: string) => {
    setSyncingEntity(entity);
    try {
      await apiFetch(`/api/admin/erpnext-sync/${entity.toLowerCase()}`, { method: 'POST' });
      appendLog({
        entity,
        action: 'sync',
        status: 'success',
        message: t('syncSuccess', { entity }),
      });
    } catch {
      appendLog({ entity, action: 'sync', status: 'error', message: t('syncConnectionError', { entity }) });
    } finally {
      setSyncingEntity(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      await apiFetch('/api/admin/erpnext-sync/sync-all', { method: 'POST' });
      appendLog({
        entity: 'All',
        action: 'sync-all',
        status: 'success',
        message: t('syncAllSuccess'),
      });
    } catch {
      appendLog({ entity: 'All', action: 'sync-all', status: 'error', message: t('syncAllConnectionError') });
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <>
      <HelmetHead
        title="Dong bo ERPNext — ERPNext Sync — AURA CAFE"
        description="Dong bo du lieu don hang, san pham, khach hang voi ERPNext tai AURA CAFE. Sync orders, products & customers with ERPNext."
      />
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-display font-bold">{t('syncTitle')}</h1>
            <Button onClick={handleSyncAll} loading={syncingAll} disabled={syncingAll}>
              &#8635; {t('syncAll')}
            </Button>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <h2 className="font-display font-semibold">{t('syncStatusTitle')}</h2>
            </CardHeader>
            <CardBody>
              <SyncStatus status={syncStatus} isLoading={isLoadingSyncStatus} />
            </CardBody>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <h2 className="font-display font-semibold">{t('syncByEntity')}</h2>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SYNC_ENTITIES.map((entity) => (
                  <SyncEntityCard
                    key={entity}
                    entity={entity}
                    syncingEntity={syncingEntity}
                    syncLogs={syncLogs}
                    onSync={triggerSync}
                  />
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-display font-semibold">{t('syncLogsTitle')}</h2>
            </CardHeader>
            <CardBody>
              <SyncLogList logs={syncLogs} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
