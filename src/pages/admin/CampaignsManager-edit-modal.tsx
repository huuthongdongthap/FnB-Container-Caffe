import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import {
  TRIGGER_LABEL_KEYS,
  ALL_CHANNELS,
  CHANNEL_LABELS,
} from './CampaignsManager-constants';
import type {
  CampaignTrigger,
  CampaignChannel,
  CampaignConfig,
} from '@/hooks/use-campaigns-admin';

interface EditModalProps {
  campaign: CampaignConfig | null;
  selectedChannels: Set<CampaignChannel>;
  onToggleChannel: (ch: CampaignChannel) => void;
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
}

export function EditCampaignModal({
  campaign,
  selectedChannels,
  onToggleChannel,
  onSave,
  onClose,
  isSaving,
}: EditModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open={campaign !== null}
      onClose={onClose}
      title={t('campaigns.modalTitle', {
        name: campaign ? t(TRIGGER_LABEL_KEYS[campaign.trigger]) : '',
      })}
    >
      {campaign && (
        <div className="space-y-5">
          {/* Info */}
          <div className="rounded-xl bg-muted/5 p-4">
            <p className="text-sm text-muted">{campaign.meta?.description}</p>
            <p className="mt-1 text-xs text-muted/60">
              {t('campaigns.timing', {
                timing: campaign.meta?.timing_hint || t('campaigns.noTiming'),
              })}
            </p>
          </div>

          {/* Channel selection */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              {t('campaigns.channelSelection')}
            </label>
            <div className="flex flex-wrap gap-3">
              {ALL_CHANNELS.map((ch) => {
                const checked = selectedChannels.has(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => onToggleChannel(ch)}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                      checked
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-white text-muted hover:border-muted/40'
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${
                        checked ? 'border-accent bg-accent' : 'border-muted/30'
                      }`}
                    >
                      {checked && (
                        <svg
                          className="h-3 w-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
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
                {t('campaigns.channelRequired')}
              </p>
            )}
          </div>

          {/* Toggle active */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              {t('campaigns.isActive')}
            </label>
            <span
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                campaign.is_active ? 'bg-green-500' : 'bg-muted/50'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  campaign.is_active
                    ? 'translate-x-[22px]'
                    : 'translate-x-[2px]'
                }`}
              />
            </span>
          </div>

          {isSaving && (
            <p className="text-sm text-muted">{t('campaigns.saving')}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose}>
              {t('campaigns.cancel')}
            </Button>
            <Button
              onClick={onSave}
              loading={isSaving}
              disabled={isSaving || selectedChannels.size === 0}
            >
              {t('campaigns.saveChanges')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
