import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useCampaignsAdmin } from '@/hooks/use-campaigns-admin';
import type {
  CampaignTrigger,
  CampaignChannel,
  CampaignConfig,
} from '@/hooks/use-campaigns-admin';
import { EditCampaignModal } from './CampaignsManager-edit-modal';
import { DeleteConfirmModal } from './CampaignsManager-delete-modal';
import { CampaignTableRow } from './CampaignsManager-table-row';
import { SkeletonRows } from './CampaignsManager-skeleton-row';

// Re-export types for consumers
export type { CampaignTrigger, CampaignChannel, CampaignConfig } from '@/hooks/use-campaigns-admin';

export default function CampaignsManagerPage() {
  const { t } = useTranslation();
  const {
    campaigns,
    isLoading,
    error,
    refetch,
    stats,
    statsLoading,
    updateCampaign,
    isSaving,
    deleteCampaign,
    isDeleting,
  } = useCampaignsAdmin();

  const [editingCampaign, setEditingCampaign] = useState<CampaignConfig | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<Set<CampaignChannel>>(new Set());
  const [deleteTrigger, setDeleteTrigger] = useState<CampaignTrigger | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────

  function openEditModal(campaign: CampaignConfig) {
    setEditingCampaign(campaign);
    setSelectedChannels(new Set(campaign.channels));
  }

  function toggleChannel(channel: CampaignChannel) {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channel)) next.delete(channel);
      else next.add(channel);
      return next;
    });
  }

  function handleSave() {
    if (!editingCampaign) return;
    const channels = Array.from(selectedChannels);
    if (channels.length === 0) return;
    updateCampaign(editingCampaign.trigger, { channels }).then(() => {
      setEditingCampaign(null);
      setSelectedChannels(new Set());
    });
  }

  function handleToggleActive(campaign: CampaignConfig) {
    updateCampaign(campaign.trigger, { is_active: campaign.is_active ? 0 : 1 });
  }

  function handleDelete() {
    if (!deleteTrigger) return;
    deleteCampaign(deleteTrigger).then(() => setDeleteTrigger(null));
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <>
      <HelmetHead
        title="Chiến dịch Marketing — Campaigns — AURA CAFE"
        description="Quản lý chiến dịch marketing tự động tại AURA CAFE."
      />
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold">{t('campaigns.title')}</h1>
              <p className="text-sm text-muted/60">{t('campaigns.subtitle')}</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800">
              <span className="flex-1">{t('campaigns.loadError', { message: error.message })}</span>
              <Button size="sm" variant="secondary" onClick={() => refetch()}>
                {t('campaigns.retry')}
              </Button>
            </div>
          )}

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/5">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('campaigns.colCampaign')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('campaigns.colChannels')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('campaigns.colStatus')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('campaigns.colSent')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('campaigns.colSuccessRate')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('campaigns.colLastRun')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">{t('campaigns.colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading && <SkeletonRows />}
                  {!isLoading && error && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <p className="text-sm text-destructive">{t('campaigns.dataError')}</p>
                      </td>
                    </tr>
                  )}
                  {!isLoading && !error && campaigns.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                        <p className="mb-1">{t('campaigns.emptyTitle')}</p>
                        <p className="text-xs text-muted/60">{t('campaigns.emptyDesc')}</p>
                      </td>
                    </tr>
                  )}
                  {!isLoading && !error && campaigns.map((campaign) => (
                    <CampaignTableRow
                      key={campaign.trigger}
                      campaign={campaign}
                      stats={stats[campaign.trigger]}
                      statsLoading={statsLoading}
                      onEdit={openEditModal}
                      onToggleActive={handleToggleActive}
                      onDelete={setDeleteTrigger}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <EditCampaignModal
        campaign={editingCampaign}
        selectedChannels={selectedChannels}
        onToggleChannel={toggleChannel}
        onSave={handleSave}
        onClose={() => { setEditingCampaign(null); setSelectedChannels(new Set()); }}
        isSaving={isSaving}
      />

      <DeleteConfirmModal
        trigger={deleteTrigger}
        onConfirm={handleDelete}
        onClose={() => setDeleteTrigger(null)}
        isDeleting={isDeleting}
      />
    </>
  );
}
