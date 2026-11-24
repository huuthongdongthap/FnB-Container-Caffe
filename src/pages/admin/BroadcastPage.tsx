/**
 * BroadcastPage — Admin broadcast messaging
 * Send bulk messages (ZNS/SMS/Email) to customer segments.
 * Orchestrator: state, hooks, handlers. Sub-views extracted.
 */

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Share2 } from 'lucide-react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { Card, CardBody } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { useClientSessionScope } from '@/lib/client-session';
import { useSegments, useSendBroadcast } from '@/hooks/use-broadcast';
import { BroadcastResultView } from './BroadcastPage-result-view';
import { BroadcastForm } from './BroadcastPage-form';
import { BroadcastConfirmModal } from './BroadcastPage-confirm-modal';
import { FacebookPromoPublishPanel } from './facebook-promo-publish-panel';
import { buildPromotionZnsDraft } from './promotion-announcement-helpers';
import type { Promotion } from './types';
import type { Channel } from './BroadcastPage-types';

export type { Channel } from './BroadcastPage-types';

type BroadcastTab = 'messaging' | 'facebook';

interface AttachedPromoMeta {
  promo_code: string;
  discount: string;
  expires_at: string;
}

function readInitialSearchParams(): { tab: BroadcastTab; promoCode: string } {
  if (typeof window === 'undefined') {
    return { tab: 'messaging', promoCode: '' };
  }
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab');
  const promoParam = (params.get('promo') || '').trim().toUpperCase();
  return {
    tab: tabParam === 'facebook' ? 'facebook' : 'messaging',
    promoCode: promoParam,
  };
}

export default function BroadcastPage() {
  const { t } = useTranslation();
  const session = useClientSessionScope();
  const initialParams = readInitialSearchParams();

  const [activeTab, setActiveTab] = useState<BroadcastTab>(initialParams.tab);
  const [segment, setSegment] = useState('');
  const [channel, setChannel] = useState<Channel>('zns');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [promoMeta, setPromoMeta] = useState<AttachedPromoMeta | null>(null);
  const [prefilledPromoCode, setPrefilledPromoCode] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: segments = [], isLoading: segmentsLoading, error: segmentsError } = useSegments(
    activeTab === 'messaging',
  );
  const sendMutation = useSendBroadcast();

  const needPromotions = activeTab === 'facebook' || Boolean(initialParams.promoCode);
  const promotionsQuery = useQuery<Promotion[]>({
    queryKey: ['broadcast-promotions', session.tenantId, session.userScope],
    queryFn: async () => {
      const res = await apiFetch<{ data?: Promotion[] }>('/api/promotions', { silent: true });
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 60_000,
    enabled: needPromotions,
  });

  const activePromotions = (promotionsQuery.data ?? []).filter((p) => p.is_active);
  const matchedPromo = initialParams.promoCode
    ? (promotionsQuery.data ?? []).find((p) => p.code.toUpperCase() === initialParams.promoCode) ?? null
    : null;

  useEffect(() => {
    if (!matchedPromo || prefilledPromoCode === matchedPromo.code) return;
    const draft = buildPromotionZnsDraft(matchedPromo);
    setTitle(draft.title);
    setMessage(draft.message);
    setPromoMeta({
      promo_code: draft.promo_code,
      discount: draft.discount,
      expires_at: draft.expires_at,
    });
    setPrefilledPromoCode(matchedPromo.code);
  }, [matchedPromo, prefilledPromoCode]);

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
      {
        segment,
        channel,
        title: title.trim(),
        message: message.trim(),
        ...(promoMeta ? promoMeta : {}),
      },
      { onSettled: () => setShowConfirm(false) },
    );
  };

  const handleReset = () => {
    setSegment('');
    setChannel('zns');
    setTitle('');
    setMessage('');
    setPromoMeta(null);
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
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6">
            <h1 className="text-2xl font-display font-bold">
              {t('broadcast.title')}
            </h1>
            <p className="mt-1 text-sm text-muted">{t('broadcast.subtitle')}</p>
          </div>

          {/* Channel group tabs: direct messaging (Zalo ZNS/SMS/Email) vs Facebook Page */}
          <div className="mb-5 flex gap-2 border-b border-border pb-3" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'messaging'}
              onClick={() => setActiveTab('messaging')}
              className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
                activeTab === 'messaging'
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-surface text-muted hover:text-foreground'
              }`}
            >
              <MessageCircle size={16} aria-hidden="true" />
              {t('broadcast.tabMessaging')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'facebook'}
              onClick={() => setActiveTab('facebook')}
              className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
                activeTab === 'facebook'
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-surface text-muted hover:text-foreground'
              }`}
            >
              <Share2 size={16} aria-hidden="true" />
              {t('broadcast.tabFacebookPage')}
            </button>
          </div>

          {activeTab === 'messaging' ? (
            <>
              {(sendMutation.error || segmentsError) && (
                <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                  <p className="font-medium">{t('broadcast.error')}</p>
                  <p className="text-sm">{(sendMutation.error || segmentsError)?.message}</p>
                </div>
              )}

              {promoMeta && (
                <div className="mb-4 flex items-center justify-between rounded-lg border border-accent/30 bg-accent/10 px-3.5 py-2 text-xs text-accent">
                  <span>{t('broadcast.promoAttachedBadge', { code: promoMeta.promo_code })}</span>
                  <button
                    type="button"
                    onClick={() => setPromoMeta(null)}
                    className="underline hover:opacity-80"
                  >
                    {t('broadcast.promoClear')}
                  </button>
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
            </>
          ) : (
            <Card>
              <CardBody>
                <FacebookPromoPublishPanel
                  promotion={matchedPromo}
                  availablePromotions={activePromotions}
                  enabled={activeTab === 'facebook'}
                />
              </CardBody>
            </Card>
          )}
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
