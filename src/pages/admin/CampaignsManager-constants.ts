import { PartyPopper, Cake, Heart, Star, Timer } from 'lucide-react';
import type {
  CampaignTrigger,
  CampaignChannel,
} from '@/hooks/use-campaigns-admin';

// ── Trigger label maps ──────────────────────────────────────────────

export const TRIGGER_LABEL_KEYS: Record<CampaignTrigger, string> = {
  welcome: 'campaigns.triggerWelcome',
  birthday: 'campaigns.triggerBirthday',
  winback: 'campaigns.triggerWinback',
  post_visit: 'campaigns.triggerPostVisit',
  cashback_expiry: 'campaigns.triggerCashbackExpiry',
};

export const TRIGGER_EN_LABEL_KEYS: Record<CampaignTrigger, string> = {
  welcome: 'campaigns.triggerWelcomeEn',
  birthday: 'campaigns.triggerBirthdayEn',
  winback: 'campaigns.triggerWinbackEn',
  post_visit: 'campaigns.triggerPostVisitEn',
  cashback_expiry: 'campaigns.triggerCashbackExpiryEn',
};

// ── Channel label / color maps ──────────────────────────────────────

export const CHANNEL_LABELS: Record<CampaignChannel, string> = {
  sms: 'SMS',
  email: 'Email',
  zalo: 'Zalo',
};

export const CHANNEL_COLORS: Record<CampaignChannel, 'info' | 'success' | 'warning'> = {
  sms: 'info',
  email: 'success',
  zalo: 'warning',
};

export const ALL_CHANNELS: CampaignChannel[] = ['sms', 'email', 'zalo'];

// ── Trigger icons ───────────────────────────────────────────────────

export const TRIGGER_EMOJI: Record<
  CampaignTrigger,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  welcome: PartyPopper,
  birthday: Cake,
  winback: Heart,
  post_visit: Star,
  cashback_expiry: Timer,
};

// ── Helpers ─────────────────────────────────────────────────────────

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
