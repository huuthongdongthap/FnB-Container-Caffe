import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Modal } from '@/components/ui/modal';
import { useCampaignsAdmin } from '@/hooks/use-campaigns-admin';
import type {
  CampaignTrigger,
  CampaignChannel,
  CampaignConfig,
  CampaignStats,
} from '@/hooks/use-campaigns-admin';

// ── Constants ────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<CampaignTrigger, string> = {
  welcome: 'Chao mung',
  birthday: 'Sinh nhat',
  winback: 'Tai kich hoat',
  post_visit: 'Sau khi ghe',
  cashback_expiry: 'Cashback sap het han',
};

const TRIGGER_EN_LABELS: Record<CampaignTrigger, string> = {
  welcome: 'Welcome',
  birthday: 'Birthday',
  winback: 'Winback',
  post_visit: 'Post-Visit',
  cashback_expiry: 'Cashback Expiry',
};

const CHANNEL_LABELS: Record<CampaignChannel, string> = {
  sms: 'SMS',
  email: 'Email',
  zalo: 'Zalo',
};

const CHANNEL_COLORS: Record<CampaignChannel, 'info' | 'success' | 'warning'> = {
  sms: 'info',
  email: 'success',
  zalo: 'warning',
};

const ALL_CHANNELS: CampaignChannel[] = ['sms', 'email', 'zalo'];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Emoji for each trigger ──
const TRIGGER_EMOJI: Record<CampaignTrigger, string> = {
  welcome: '🎉',
  birthday: '🎂',
  winback: '💌',
  post_visit: '⭐',
  cashback_expiry: '⏰',
};

// ── Component ────────────────────────────────────────────────────────

export default function CampaignsManagerPage() {
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

  // Modal state
  const [editingCampaign, setEditingCampaign] = useState<CampaignConfig | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<Set<CampaignChannel>>(new Set());
  const [deleteTrigger, setDeleteTrigger] = useState<CampaignTrigger | null>(null);

  // ── Modal handlers ───────────────────────────────────────────────

  function openEditModal(campaign: CampaignConfig) {
    setEditingCampaign(campaign);
    setSelectedChannels(new Set(campaign.channels));
  }

  function closeEditModal() {
    setEditingCampaign(null);
    setSelectedChannels(new Set());
  }

  function toggleChannel(channel: CampaignChannel) {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channel)) {
        next.delete(channel);
      } else {
        next.add(channel);
      }
      return next;
    });
  }

  function handleSave() {
    if (!editingCampaign) return;

    const channels = Array.from(selectedChannels);
    if (channels.length === 0) return;

    updateCampaign(editingCampaign.trigger, { channels }).then(() => {
      closeEditModal();
    });
  }

  function handleToggleActive(campaign: CampaignConfig) {
    updateCampaign(campaign.trigger, { is_active: campaign.is_active ? 0 : 1 });
  }

  function handleDelete() {
    if (deleteTrigger) {
      deleteCampaign(deleteTrigger).then(() => {
        setDeleteTrigger(null);
      });
    }
  }

  // ── Stats lookup helper ──
  function getStats(trigger: CampaignTrigger): CampaignStats | undefined {
    return stats[trigger];
  }

  // ── Render helpers ───────────────────────────────────────────────

  function renderSkeletonRows(count = 5) {
    return Array.from({ length: count }).map((_, i) => (
      <tr key={i}>
        <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
        <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
        <td className="px-4 py-3"><Skeleton className="h-6 w-16 rounded-full" /></td>
        <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
        <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
        <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
        <td className="px-4 py-3"><Skeleton className="h-8 w-20 ml-auto" /></td>
      </tr>
    ));
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Quan ly Chien dich Marketing</h1>
            <p className="text-sm text-muted/60">Quan ly cac chien dich tu dong: chao mung, sinh nhat, tai kich hoat va hon the</p>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-4 flex items-center gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            <span className="flex-1">Loi tai danh sach chien dich: {error.message}</span>
            <Button size="sm" variant="secondary" onClick={() => refetch()}>
              Thu lai
            </Button>
          </div>
        )}

        {/* Campaigns table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/5">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Chien dich</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Kenh</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Trang thai</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Da gui</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Ty le thanh cong</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Lan chay cuoi</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">Thao tac</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Loading */}
                {isLoading && renderSkeletonRows()}

                {/* Error (no data) */}
                {!isLoading && error && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <p className="text-sm text-destructive">Loi tai du lieu chien dich</p>
                    </td>
                  </tr>
                )}

                {/* Empty */}
                {!isLoading && !error && campaigns.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                      <p className="mb-1">Chua co chien dich nao</p>
                      <p className="text-xs text-muted/60">Cac chien dich se duoc tao tu dong khi tai trang</p>
                    </td>
                  </tr>
                )}

                {/* Campaign rows */}
                {!isLoading && !error && campaigns.map((campaign) => {
                  const s = getStats(campaign.trigger);
                  return (
                    <tr key={campaign.trigger} className="hover:bg-muted/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{TRIGGER_EMOJI[campaign.trigger]}</span>
                          <div>
                            <p className="text-sm font-semibold">
                              {TRIGGER_LABELS[campaign.trigger]}
                            </p>
                            <p className="text-xs text-muted">
                              {TRIGGER_EN_LABELS[campaign.trigger]}
                              {campaign.meta?.timing_hint && (
                                <span className="ml-2">· {campaign.meta.timing_hint}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {campaign.channels.map((ch) => (
                            <Badge key={ch} variant={CHANNEL_COLORS[ch]}>
                              {CHANNEL_LABELS[ch]}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={campaign.is_active ? 'success' : 'destructive'}>
                          {campaign.is_active ? 'Hoat dong' : 'Tat'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {statsLoading ? (
                          <Skeleton className="h-4 w-12" />
                        ) : (
                          <span className="font-medium">{s?.total_sent ?? 0}</span>
                        )}
                        {s && s.unique_customers > 0 && (
                          <span className="ml-1 text-xs text-muted">
                            ({s.unique_customers} KH)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {statsLoading ? (
                          <Skeleton className="h-4 w-12" />
                        ) : (
                          <span className={s && s.success_rate >= 80 ? 'text-green-600' : s && s.success_rate >= 50 ? 'text-yellow-600' : ''}>
                            {s ? `${s.success_rate}%` : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {statsLoading ? (
                          <Skeleton className="h-4 w-24" />
                        ) : (
                          formatDate(s?.last_run_at ?? null)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(campaign)}
                          >
                            Cau hinh
                          </Button>
                          <Button
                            size="sm"
                            variant={campaign.is_active ? 'destructive' : 'secondary'}
                            onClick={() => handleToggleActive(campaign)}
                          >
                            {campaign.is_active ? 'Tat' : 'Bat'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteTrigger(campaign.trigger)}
                          >
                            Xoa
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ─────────────── Edit Campaign Modal ─────────────── */}
      <Modal
        open={editingCampaign !== null}
        onClose={closeEditModal}
        title={`Cau hinh: ${editingCampaign ? TRIGGER_LABELS[editingCampaign.trigger] : ''}`}
      >
        {editingCampaign && (
          <div className="space-y-5">
            {/* Info */}
            <div className="rounded-xl bg-muted/5 p-4">
              <p className="text-sm text-muted">{editingCampaign.meta?.description}</p>
              <p className="mt-1 text-xs text-muted/60">
                Lich: {editingCampaign.meta?.timing_hint || 'Khong co'}
              </p>
            </div>

            {/* Channel selection */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Kenh gui
              </label>
              <div className="flex flex-wrap gap-3">
                {ALL_CHANNELS.map((ch) => {
                  const checked = selectedChannels.has(ch);
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleChannel(ch)}
                      className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                        checked
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border bg-white text-muted hover:border-muted/40'
                      }`}
                    >
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${
                          checked
                            ? 'border-accent bg-accent'
                            : 'border-muted/30'
                        }`}
                      >
                        {checked && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      {CHANNEL_LABELS[ch]}
                    </button>
                  );
                })}
              </div>
              {selectedChannels.size === 0 && (
                <p className="mt-1 text-sm text-destructive">
                  Vui long chon it nhat mot kenh gui
                </p>
              )}
            </div>

            {/* Toggle active */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Dang hoat dong</label>
              <button
                type="button"
                role="switch"
                aria-checked={selectedChannels.size > 0 && editingCampaign.is_active === 1}
                onClick={() => {
                  /* toggle handled via save — this is just display */ }
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-default items-center rounded-full transition-colors ${
                  editingCampaign.is_active ? 'bg-green-500' : 'bg-muted/50'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    editingCampaign.is_active ? 'translate-x-[22px]' : 'translate-x-[2px]'
                  }`}
                />
              </button>
            </div>

            {/* Save errors */}
            {isSaving && (
              <p className="text-sm text-muted">Dang luu...</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={closeEditModal}>
                Huy
              </Button>
              <Button
                onClick={handleSave}
                loading={isSaving}
                disabled={isSaving || selectedChannels.size === 0}
              >
                Luu thay doi
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─────────────── Confirm Delete ─────────────── */}
      <Modal
        open={deleteTrigger !== null}
        onClose={() => setDeleteTrigger(null)}
        title="Xac nhan xoa"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Ban co chac chan muon xoa cau hinh chien dich{' '}
            <strong>{deleteTrigger ? TRIGGER_LABELS[deleteTrigger] : ''}</strong>?
            Cau hinh se duoc dat lai mac dinh khi tai lai trang.
          </p>
          {isDeleting && (
            <p className="text-sm text-muted">Dang xoa...</p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTrigger(null)}>
              Huy
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              loading={isDeleting}
              disabled={isDeleting}
            >
              Xoa
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
