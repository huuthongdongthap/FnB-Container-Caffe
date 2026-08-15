import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TRIGGER_LABEL_KEYS,
  TRIGGER_EN_LABEL_KEYS,
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  TRIGGER_EMOJI,
  formatDate,
} from './CampaignsManager-constants';
import type {
  CampaignTrigger,
  CampaignConfig,
  CampaignStats,
} from '@/hooks/use-campaigns-admin';

interface TableRowProps {
  campaign: CampaignConfig;
  stats: CampaignStats | undefined;
  statsLoading: boolean;
  onEdit: (c: CampaignConfig) => void;
  onToggleActive: (c: CampaignConfig) => void;
  onDelete: (t: CampaignTrigger) => void;
}

export function CampaignTableRow({
  campaign,
  stats,
  statsLoading,
  onEdit,
  onToggleActive,
  onDelete,
}: TableRowProps) {
  const { t } = useTranslation();
  const Icon = TRIGGER_EMOJI[campaign.trigger];

  return (
    <tr className="hover:bg-muted/5 transition-colors">
      {/* Campaign name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={18} aria-hidden="true" />}
          <div>
            <p className="text-sm font-semibold">
              {t(TRIGGER_LABEL_KEYS[campaign.trigger])}
            </p>
            <p className="text-xs text-muted">
              {t(TRIGGER_EN_LABEL_KEYS[campaign.trigger])}
              {campaign.meta?.timing_hint && (
                <span className="ml-2">· {campaign.meta.timing_hint}</span>
              )}
            </p>
          </div>
        </div>
      </td>

      {/* Channels */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {campaign.channels.map((ch) => (
            <Badge key={ch} variant={CHANNEL_COLORS[ch]}>
              {CHANNEL_LABELS[ch]}
            </Badge>
          ))}
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge variant={campaign.is_active ? 'success' : 'destructive'}>
          {campaign.is_active ? t('campaigns.active') : t('campaigns.inactive')}
        </Badge>
      </td>

      {/* Sent */}
      <td className="px-4 py-3 text-sm">
        {statsLoading ? (
          <Skeleton className="h-4 w-12" />
        ) : (
          <span className="font-medium">{stats?.total_sent ?? 0}</span>
        )}
        {stats && stats.unique_customers > 0 && (
          <span className="ml-1 text-xs text-muted">
            {t('campaigns.customersLabel', { count: stats.unique_customers })}
          </span>
        )}
      </td>

      {/* Success rate */}
      <td className="px-4 py-3 text-sm">
        {statsLoading ? (
          <Skeleton className="h-4 w-12" />
        ) : (
          <span
            className={
              stats && stats.success_rate >= 80
                ? 'text-green-600'
                : stats && stats.success_rate >= 50
                  ? 'text-yellow-600'
                  : ''
            }
          >
            {stats ? `${stats.success_rate}%` : '—'}
          </span>
        )}
      </td>

      {/* Last run */}
      <td className="px-4 py-3 text-sm text-muted">
        {statsLoading ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          formatDate(stats?.last_run_at ?? null)
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => onEdit(campaign)}>
            {t('campaigns.configure')}
          </Button>
          <Button
            size="sm"
            variant={campaign.is_active ? 'destructive' : 'secondary'}
            onClick={() => onToggleActive(campaign)}
          >
            {campaign.is_active ? t('campaigns.turnOff') : t('campaigns.turnOn')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(campaign.trigger)}
          >
            {t('campaigns.delete')}
          </Button>
        </div>
      </td>
    </tr>
  );
}
