/**
 * Canonical Notification Domain Models & Types
 * Defines the contract across Domain Events, Notification Intents, Channels, Providers, and Results.
 */

export type ChannelType = 'web_push' | 'zalo_zns' | 'sms' | 'email' | 'telegram' | 'in_app';

export type ProviderType = 'vapid' | 'zalo' | 'speedsms' | 'resend' | 'telegram_bot' | 'd1_inbox';

export type DeliveryStatus =
  | 'pending'
  | 'queued'
  | 'dispatched'
  | 'delivered'
  | 'failed'
  | 'dead_letter'
  | 'suppressed';

export type NotificationPriority = 'high' | 'normal' | 'low';

export interface RecipientInfo {
  customerId?: string | null;
  phone?: string | null;
  email?: string | null;
  pushSubscription?: unknown | null;
  telegramChatId?: string | null;
  userId?: string | null;
}

export interface DomainNotificationEvent {
  id: string;
  name: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  correlationId?: string | null;
  tenantId?: string | null;
  operatingUnitId?: string | null;
}

export interface NotificationIntent {
  id: string;
  eventId: string;
  channel: ChannelType;
  provider: ProviderType;
  recipient: RecipientInfo;
  templateId: string;
  renderedPayload: Record<string, unknown>;
  idempotencyKey: string;
  status: DeliveryStatus;
  retryCount: number;
  maxRetries: number;
  correlationId?: string | null;
  tenantId?: string | null;
  operatingUnitId?: string | null;
  errorReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderCallback {
  provider: ProviderType;
  providerMessageId: string;
  idempotencyKey: string;
  status: 'delivered' | 'failed';
  rawPayload?: Record<string, unknown>;
  signature?: string;
  timestamp?: string;
}

export interface NotificationResult {
  ok: boolean;
  intentId: string;
  status: DeliveryStatus;
  providerMessageId?: string | null;
  error?: string | null;
  retryable?: boolean;
}
