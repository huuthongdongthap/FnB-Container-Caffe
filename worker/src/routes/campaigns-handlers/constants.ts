import type { CampaignTrigger, CampaignChannel } from '@aura/domain-crm';

export const ALL_TRIGGERS: CampaignTrigger[] = [
  'welcome',
  'birthday',
  'winback',
  'post_visit',
  'cashback_expiry'
];

export const ALL_CHANNELS: CampaignChannel[] = ['sms', 'email', 'zalo'];

export interface CampaignConfig {
  trigger: CampaignTrigger;
  is_active: number;
  channels: string; // JSON array
  timing: string | null;
  updated_at: string | null;
}

export interface TriggerMeta {
  label: string;
  label_vn: string;
  description: string;
  default_channels: string[];
  timing_hint: string;
}

export const TRIGGER_META: Record<CampaignTrigger, TriggerMeta> = {
  welcome: {
    label: 'Welcome',
    label_vn: 'Chao mung',
    description: 'Gui tin nhan chao mung khach hang moi trong 24h',
    default_channels: ['sms', 'email'],
    timing_hint: 'Moi 15 phut'
  },
  birthday: {
    label: 'Birthday',
    label_vn: 'Sinh nhat',
    description: 'Gui uu dai sinh nhat cho khach hang',
    default_channels: ['sms', 'zalo'],
    timing_hint: 'Hang ngay'
  },
  winback: {
    label: 'Winback',
    label_vn: 'Tai kich hoat',
    description: 'Gui tin nhan cho khach hang khong quay lai 30 ngay',
    default_channels: ['sms'],
    timing_hint: 'Hang ngay'
  },
  post_visit: {
    label: 'Post-Visit',
    label_vn: 'Sau khi ghe',
    description: 'Gui yeu cau danh gia sau khi khach hang ghe quan',
    default_channels: ['sms'],
    timing_hint: 'Moi 30 phut'
  },
  cashback_expiry: {
    label: 'Cashback Expiry',
    label_vn: 'Cashback sap het han',
    description: 'Nhan nhac cashback sap het han truoc 7 ngay',
    default_channels: ['sms'],
    timing_hint: 'Hang ngay'
  }
};
