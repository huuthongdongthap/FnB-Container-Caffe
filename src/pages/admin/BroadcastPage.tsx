/**
 * BroadcastPage — Admin broadcast messaging
 * Send bulk messages (ZNS/SMS/Email) to customer segments.
 * Dark theme, bilingual VN/EN.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useSegments, useSendBroadcast } from '@/hooks/use-broadcast';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  MessageCircle,
  Smartphone,
  Mail,
  Send,
  Clock,
  CheckCircle,
  Megaphone,
  X,
  FileText,
  AlertTriangle,
  Check,
} from 'lucide-react';

type Channel = 'zns' | 'sms' | 'email' | 'all';

const CHANNEL_OPTIONS: { value: Channel; labelKey: string; icon: React.ElementType }[] = [
  { value: 'zns', labelKey: 'broadcast.channelZns', icon: MessageCircle },
  { value: 'sms', labelKey: 'broadcast.channelSms', icon: Smartphone },
  { value: 'email', labelKey: 'broadcast.channelEmail', icon: Mail },
  { value: 'all', labelKey: 'broadcast.channelAll', icon: Send },
];

export default function BroadcastPage() {
  const { t } = useTranslation();

  // ── Form state ──
  const [segment, setSegment] = useState('');
  const [channel, setChannel] = useState<Channel>('zns');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  // ── Confirmation modal ──
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Server state ──
  const { data: segments = [], isLoading: segmentsLoading } = useSegments();
  const sendMutation = useSendBroadcast();

  // ── Derived ──
  const selectedSegment = segments.find((s) => s.id === segment);
  const customerCount = selectedSegment?.count || 0;
  const isFormValid = segment && channel && message.trim().length > 0;

  // ── Channel labels via i18n ──
  const channelLabels: Record<string, string> = {
    zns: t('broadcast.channelZns'),
    sms: t('broadcast.channelSms'),
    email: t('broadcast.channelEmail'),
    all: t('broadcast.channelAllDesc'),
  };

  // ── Preview text ──
  const previewText =
    segment && channel
      ? t('broadcast.preview', { count: customerCount.toLocaleString('vi-VN'), channel: channelLabels[channel] })
      : '';

  // ── Handlers ──
  const handleSend = () => {
    if (!isFormValid) return;
    sendMutation.mutate(
      { segment, channel, title: title.trim(), message: message.trim() },
      {
        onSettled: () => {
          setShowConfirm(false);
        },
      },
    );
  };

  const handleReset = () => {
    setSegment('');
    setChannel('zns');
    setTitle('');
    setMessage('');
    sendMutation.reset();
  };

  // ── Render result ──
  if (sendMutation.data) {
    const result = sendMutation.data;
    return (
      <div className="min-h-screen bg-background p-6 dark:bg-gray-950">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <h1 className="text-xl font-display font-bold">
                {t('broadcast.sendResult')}
              </h1>
            </CardHeader>
            <CardBody>
              {result.pending ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg bg-amber-50 p-4 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    <Clock size={24} aria-hidden="true" />
                    <div>
                      <p className="font-medium">{t('broadcast.sendingBg')}</p>
                      <p className="text-sm">
                        {t('broadcast.totalCustomers', { total: result.total, channels: result.channels?.join(', ') })}
                      </p>
                    </div>
                  </div>
                  {Object.keys(result.skipped || {}).length > 0 && (
                    <div className="rounded-lg bg-gray-50 p-3 text-sm text-muted dark:bg-gray-800">
                      <p className="font-medium">{t('broadcast.skippedChannels')}</p>
                      {Object.entries(result.skipped || {}).map(([ch, reason]) => (
                        <p key={ch} className="ml-2 text-xs">
                          - {ch}: {reason}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    <CheckCircle size={24} aria-hidden="true" className="text-green-500" />
                    <div>
                      <p className="font-medium">
                        {t('broadcast.sendSuccess')}
                      </p>
                      <p className="text-sm">
                        {t('broadcast.sendStats', { sent: result.sent_count, failed: result.failed_count, total: result.total })}
                      </p>
                    </div>
                  </div>
                  {Object.keys(result.skipped || {}).length > 0 && (
                    <div className="rounded-lg bg-gray-50 p-3 text-sm text-muted dark:bg-gray-800">
                      <p className="font-medium">{t('broadcast.skippedChannels')}</p>
                      {Object.entries(result.skipped || {}).map(([ch, reason]) => (
                        <p key={ch} className="ml-2 text-xs">
                          - {ch}: {reason}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="mt-6 flex gap-3">
                <Button onClick={handleReset} variant="secondary">
                  {t('broadcast.sendAgain')}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <HelmetHead
        title="Gửi tin nhắn hàng loạt — Broadcast — AURA CAFE"
        description="Gửi tin nhắn ZNS, SMS và Email đến khách hàng tại AURA CAFE. Bulk messaging via ZNS, SMS & Email."
      />
      <div className="min-h-screen bg-background p-6 dark:bg-gray-950">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6">
            <h1 className="text-2xl font-display font-bold">
              <Megaphone size={24} aria-hidden="true" className="mr-2 inline-block" />
              {t('broadcast.title')}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t('broadcast.subtitle')}
          </p>
        </div>

        {/* Error state */}
        {sendMutation.error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/30 dark:text-red-300">
            <div className="flex items-start gap-3">
              <X size={20} aria-hidden="true" />
              <div className="flex-1">
                <p className="font-medium">{t('broadcast.error')}</p>
                <p className="text-sm">{sendMutation.error.message}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => sendMutation.reset()}
              >
                {t('broadcast.retry')}
              </Button>
            </div>
          </div>
        )}

        <Card>
          <CardBody className="space-y-5">
            {/* ── Segment selector ── */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('broadcast.segmentLabel')}
              </label>
              {segmentsLoading ? (
                <div className="h-10 animate-pulse rounded-lg bg-muted/30" />
              ) : (
                <select
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-base text-foreground transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent dark:bg-gray-800"
                  aria-label={t('broadcast.selectSegment')}
                >
                  <option value="">{t('broadcast.selectSegment')}</option>
                  {segments.map((seg) => (
                    <option key={seg.id} value={seg.id}>
                      {seg.name} ({seg.count.toLocaleString('vi-VN')})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* ── Channel selector ── */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('broadcast.channelLabel')}
              </label>
              <div className="flex flex-wrap gap-3">
                {CHANNEL_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                      channel === opt.value
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-white hover:bg-muted/10 dark:bg-gray-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="channel"
                      value={opt.value}
                      checked={channel === opt.value}
                      onChange={() => setChannel(opt.value)}
                      className="sr-only"
                    />
                    <opt.icon size={20} aria-hidden="true" />
                    <span>{t(opt.labelKey)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── Title input ── */}
            <Input
              label={t('broadcast.titleLabel')}
              placeholder={t('broadcast.titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            {/* ── Message textarea ── */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('broadcast.messageLabel')}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-base text-foreground placeholder:text-muted transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent dark:bg-gray-800"
                placeholder={t('broadcast.messagePlaceholder')}
              />
              <p className="mt-1 text-xs text-muted">
                {t('broadcast.charCount', { count: message.length })}
              </p>
            </div>

            {/* ── Preview ── */}
            {previewText && (
              <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                <FileText size={20} aria-hidden="true" className="mr-1 inline-block" /> {previewText}
              </div>
            )}

            {/* ── Send button ── */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setShowConfirm(true)}
                disabled={!isFormValid || sendMutation.isPending}
                loading={sendMutation.isPending}
                size="lg"
                className="w-full"
              >
                {sendMutation.isPending ? t('broadcast.sending') : <><Send size={20} aria-hidden="true" className="mr-1 inline-block" /> {t('broadcast.send')}</>}
              </Button>
              {sendMutation.data && (
                <Button onClick={handleReset} variant="secondary">
                  {t('broadcast.sendAgain')}
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ── Confirmation modal ── */}
      <Modal open={showConfirm} onClose={() => setShowConfirm(false)} title={t('broadcast.confirmTitle')}>
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-800">
            <p className="font-medium"><FileText size={20} aria-hidden="true" className="mr-1 inline-block" /> {t('broadcast.details')}</p>
            <ul className="mt-2 space-y-1 text-muted">
              <li>
                {t('broadcast.segment')}: <strong>{selectedSegment?.name}</strong>
              </li>
              <li>
                {t('broadcast.quantity')}: <strong>{customerCount.toLocaleString('vi-VN')}</strong> {t('broadcast.customers')}
              </li>
              <li>
                {t('broadcast.channel')}: <strong>{channelLabels[channel]}</strong>
              </li>
              {title && <li>{t('broadcast.titleLabel')}: <strong>{title}</strong></li>}
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-white p-3 text-sm dark:bg-gray-800">
            <p className="mb-1 font-medium">{t('broadcast.messageContent')}</p>
            <p className="whitespace-pre-wrap text-muted">{message}</p>
          </div>

          {customerCount > 100 && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              <AlertTriangle size={20} aria-hidden="true" className="mr-1 inline-block text-amber-500" /> {t('broadcast.confirmWarning', { count: customerCount.toLocaleString('vi-VN') })}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSend}
              loading={sendMutation.isPending}
              disabled={sendMutation.isPending}
              className="flex-1"
            >
              {sendMutation.isPending ? t('broadcast.sending') : <><Check size={20} aria-hidden="true" className="mr-1 inline-block" /> {t('broadcast.confirm')}</>}
            </Button>
            <Button
              onClick={() => setShowConfirm(false)}
              variant="secondary"
              disabled={sendMutation.isPending}
              className="flex-1"
            >
              {t('broadcast.cancel')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
    </>
  );
}
