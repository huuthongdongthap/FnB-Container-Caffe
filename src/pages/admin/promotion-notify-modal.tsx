/**
 * PromotionNotifyModal — Announce a promotion to customers via Zalo ZNS or Facebook Page (Mixpost).
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { CheckCircle, Clock, MessageCircle, Send, Share2 } from 'lucide-react';
import { useSegments, useSendBroadcast } from '@/hooks/use-broadcast';
import type { Promotion } from './types';
import { buildPromotionZnsDraft } from './promotion-announcement-helpers';
import { FacebookPromoPublishPanel } from './facebook-promo-publish-panel';

interface PromotionNotifyModalProps {
  promotion: Promotion | null;
  onClose: () => void;
}

type NotifyTab = 'zalo' | 'facebook';

export function PromotionNotifyModal({ promotion, onClose }: PromotionNotifyModalProps) {
  const { t } = useTranslation();
  const { t: tPromo } = useTranslation('adminPromotions');

  const isOpen = promotion !== null;
  const [activeTab, setActiveTab] = useState<NotifyTab>('zalo');
  const [segment, setSegment] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [confirmingZalo, setConfirmingZalo] = useState(false);
  const [promoMeta, setPromoMeta] = useState<{ promo_code: string; discount: string; expires_at: string }>({
    promo_code: '',
    discount: '',
    expires_at: '',
  });

  const segmentsQuery = useSegments(isOpen && activeTab === 'zalo');
  const sendMutation = useSendBroadcast();

  useEffect(() => {
    if (!promotion) return;
    const draft = buildPromotionZnsDraft(promotion);
    setActiveTab('zalo');
    setSegment('');
    setTitle(draft.title);
    setMessage(draft.message);
    setConfirmingZalo(false);
    setPromoMeta({
      promo_code: draft.promo_code,
      discount: draft.discount,
      expires_at: draft.expires_at,
    });
    sendMutation.reset();
  }, [
    promotion?.code,
    promotion?.percent,
    promotion?.discount_type,
    promotion?.type,
    promotion?.discount_value,
    promotion?.value,
    promotion?.max_discount,
    promotion?.min_order,
    promotion?.expires_at,
  ]);

  const segments = segmentsQuery.data ?? [];
  const selectedSegment = segments.find((s) => s.id === segment);
  const canSendZalo = Boolean(segment && message.trim() && !sendMutation.isPending);

  const handleRequestZaloConfirm = () => {
    if (!canSendZalo) return;
    setConfirmingZalo(true);
  };

  const handleSendZalo = () => {
    if (!canSendZalo) return;
    setConfirmingZalo(false);
    sendMutation.mutate({
      segment,
      channel: 'zns',
      title: title.trim(),
      message: message.trim(),
      promo_code: promoMeta.promo_code,
      discount: promoMeta.discount,
      expires_at: promoMeta.expires_at,
    });
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={promotion ? tPromo('notifyModalTitle', { code: promotion.code }) : ''}
    >
      {promotion && (
        <div className="space-y-4">
          {/* Channel mode tabs */}
          <div className="flex gap-2 border-b border-border pb-3" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'zalo'}
              onClick={() => setActiveTab('zalo')}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'zalo'
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-surface text-muted hover:text-foreground'
              }`}
            >
              <MessageCircle size={16} aria-hidden="true" />
              {tPromo('notifyTabZalo')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'facebook'}
              onClick={() => setActiveTab('facebook')}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'facebook'
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-surface text-muted hover:text-foreground'
              }`}
            >
              <Share2 size={16} aria-hidden="true" />
              {tPromo('notifyTabFacebook')}
            </button>
          </div>

          {activeTab === 'zalo' ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-300">
                {t('broadcast.znsConfigHint')}
              </div>

              <div>
                <label htmlFor="promo-zns-segment" className="mb-1.5 block text-sm font-medium text-foreground">
                  {t('broadcast.segmentLabel')}
                </label>
                {segmentsQuery.isLoading ? (
                  <div className="h-10 animate-pulse rounded-lg bg-muted/30" />
                ) : (
                  <select
                    id="promo-zns-segment"
                    value={segment}
                    onChange={(e) => {
                      setSegment(e.target.value);
                      setConfirmingZalo(false);
                    }}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
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

              <Input
                label={t('broadcast.titleLabel')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <div>
                <label htmlFor="promo-zns-message" className="mb-1.5 block text-sm font-medium text-foreground">
                  {t('broadcast.messageLabel')}
                </label>
                <textarea
                  id="promo-zns-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                />
              </div>

              {(sendMutation.error || segmentsQuery.error) && (
                <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                  <p className="font-medium">{t('broadcast.error')}</p>
                  <p className="text-xs">{(sendMutation.error || segmentsQuery.error)?.message}</p>
                </div>
              )}

              {sendMutation.data && (
                <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                  {sendMutation.data.pending ? (
                    <Clock size={18} aria-hidden="true" />
                  ) : (
                    <CheckCircle size={18} aria-hidden="true" />
                  )}
                  <span>
                    {sendMutation.data.pending
                      ? t('broadcast.totalCustomers', {
                          total: sendMutation.data.total ?? 0,
                          channels: sendMutation.data.channels?.join(', ') ?? 'zns',
                        })
                      : t('broadcast.sendStats', {
                          sent: sendMutation.data.sent_count ?? 0,
                          failed: sendMutation.data.failed_count ?? 0,
                          total: sendMutation.data.total ?? 0,
                        })}
                  </span>
                </div>
              )}

              {confirmingZalo ? (
                <div
                  role="region"
                  aria-label={t('broadcast.confirmTitle')}
                  className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3"
                >
                  <p className="text-sm font-semibold text-amber-200">{t('broadcast.confirmTitle')}</p>
                  <p className="text-xs text-amber-100">
                    {t('broadcast.confirmWarning', { count: selectedSegment?.count ?? 0 })}
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setConfirmingZalo(false)}>
                      {t('broadcast.cancel')}
                    </Button>
                    <Button
                      onClick={handleSendZalo}
                      disabled={!canSendZalo}
                      loading={sendMutation.isPending}
                    >
                      <Send size={15} aria-hidden="true" className="mr-1.5 inline-block" />
                      {t('broadcast.confirm')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" onClick={onClose}>
                    {tPromo('cancel')}
                  </Button>
                  <Button
                    onClick={handleRequestZaloConfirm}
                    disabled={!canSendZalo}
                    loading={sendMutation.isPending}
                  >
                    <Send size={15} aria-hidden="true" className="mr-1.5 inline-block" />
                    {sendMutation.isPending ? t('broadcast.sending') : t('broadcast.send')}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <FacebookPromoPublishPanel promotion={promotion} enabled={isOpen && activeTab === 'facebook'} />
          )}
        </div>
      )}
    </Modal>
  );
}
