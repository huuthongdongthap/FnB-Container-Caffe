/**
 * BroadcastPage — Admin broadcast messaging
 * Send bulk messages (ZNS/SMS/Email) to customer segments.
 * Orchestrator: state, hooks, handlers. Sub-views extracted.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useSegments, useSendBroadcast } from '@/hooks/use-broadcast';
import { BroadcastResultView } from './BroadcastPage-result-view';
import { BroadcastForm } from './BroadcastPage-form';
import { BroadcastConfirmModal } from './BroadcastPage-confirm-modal';
import type { Channel } from './BroadcastPage-types';

export type { Channel } from './BroadcastPage-types';

export default function BroadcastPage() {
  const { t } = useTranslation();

  const [segment, setSegment] = useState('');
  const [channel, setChannel] = useState<Channel>('zns');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: segments = [], isLoading: segmentsLoading } = useSegments();
  const sendMutation = useSendBroadcast();

  const selectedSegment = segments.find((s) => s.id === segment);
  const customerCount = selectedSegment?.count || 0;
  const isFormValid = !!segment && !!channel && message.trim().length > 0;

  const channelLabels: Record<Channel, string> = {
    zns: t('broadcast.channelZns'),
    sms: t('broadcast.channelSms'),
    email: t('broadcast.channelEmail'),
    all: t('broadcast.channelAllDesc'),
  };

  const previewText =
    segment && channel
      ? t('broadcast.preview', { count: customerCount.toLocaleString('vi-VN'), channel: channelLabels[channel] })
      : '';

  const handleSend = () => {
    if (!isFormValid) return;
    sendMutation.mutate(
      { segment, channel, title: title.trim(), message: message.trim() },
      { onSettled: () => setShowConfirm(false) },
    );
  };

  const handleReset = () => {
    setSegment('');
    setChannel('zns');
    setTitle('');
    setMessage('');
    sendMutation.reset();
  };

  if (sendMutation.data) {
    return <BroadcastResultView result={sendMutation.data} onReset={handleReset} />;
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
              {t('broadcast.title')}
            </h1>
            <p className="mt-1 text-sm text-muted">{t('broadcast.subtitle')}</p>
          </div>

          {sendMutation.error && (
            <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/30 dark:text-red-300">
              <p className="font-medium">{t('broadcast.error')}</p>
              <p className="text-sm">{sendMutation.error.message}</p>
            </div>
          )}

          <BroadcastForm
            segment={segment} setSegment={setSegment}
            channel={channel} setChannel={setChannel}
            title={title} setTitle={setTitle}
            message={message} setMessage={setMessage}
            segments={segments} segmentsLoading={segmentsLoading}
            isFormValid={isFormValid} previewText={previewText}
            isPending={sendMutation.isPending} hasData={!!sendMutation.data}
            onOpenConfirm={() => setShowConfirm(true)} onReset={handleReset}
          />
        </div>
      </div>

      <BroadcastConfirmModal
        open={showConfirm} onClose={() => setShowConfirm(false)} onConfirm={handleSend}
        segmentName={selectedSegment?.name || ''} customerCount={customerCount}
        channel={channel} channelLabel={channelLabels[channel]}
        title={title} message={message} isPending={sendMutation.isPending}
      />
    </>
  );
}
