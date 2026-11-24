/**
 * FacebookPromoPublishPanel — Publish or schedule promotion posts to a connected Facebook Page via Mixpost.
 *
 * Explicit Page publishing only (not personal Facebook Messenger).
 * Surfaces configuration/connection errors honestly and never reports success without a returned postId.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle, Share2, Sparkles } from 'lucide-react';
import {
  isFacebookPageAccount,
  isMixpostNotConfiguredError,
  useGeneratePromoPost,
  useMixpostAccounts,
  usePublishMixpostPost,
} from '@/hooks/use-mixpost-social';
import type { Promotion } from './types';
import { buildPromotionFacebookDraft } from './promotion-announcement-helpers';

interface FacebookPromoPublishPanelProps {
  promotion?: Promotion | null;
  availablePromotions?: Promotion[];
  initialContent?: string;
  enabled?: boolean;
}

export function FacebookPromoPublishPanel({
  promotion = null,
  availablePromotions = [],
  initialContent = '',
  enabled = true,
}: FacebookPromoPublishPanelProps) {
  const { t } = useTranslation();
  const [selectedPromoCode, setSelectedPromoCode] = useState<string>(promotion?.code ?? '');
  const [content, setContent] = useState<string>(
    initialContent || (promotion ? buildPromotionFacebookDraft(promotion) : ''),
  );
  const [scheduledLocal, setScheduledLocal] = useState<string>('');
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);

  const accountsQuery = useMixpostAccounts(enabled);
  const generateMutation = useGeneratePromoPost();
  const publishMutation = usePublishMixpostPost();

  const fbAccounts = (accountsQuery.data ?? []).filter(isFacebookPageAccount);

  useEffect(() => {
    if (promotion) {
      setSelectedPromoCode(promotion.code);
      setContent(buildPromotionFacebookDraft(promotion));
      publishMutation.reset();
    }
  }, [promotion?.code]);

  useEffect(() => {
    const firstAccount = fbAccounts[0];
    if (fbAccounts.length === 1 && firstAccount && selectedAccounts.length === 0) {
      setSelectedAccounts([firstAccount.id]);
    }
  }, [fbAccounts.length]);

  const toggleAccount = (id: number) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectPromo = (promo: Promotion) => {
    setSelectedPromoCode(promo.code);
    setContent(buildPromotionFacebookDraft(promo));
    publishMutation.reset();
  };

  const handleGenerate = () => {
    if (!selectedPromoCode) return;
    generateMutation.mutate(selectedPromoCode, {
      onSuccess: (res) => {
        if (res?.data?.content) {
          setContent(res.data.content);
        }
      },
    });
  };

  const handlePublish = () => {
    if (selectedAccounts.length === 0 || !content.trim()) return;
    const scheduledAtIso = scheduledLocal ? new Date(scheduledLocal).toISOString() : undefined;
    publishMutation.mutate({
      content: content.trim(),
      accounts: selectedAccounts,
      scheduled_at: scheduledAtIso,
    });
  };

  const notConfigured = accountsQuery.isError && isMixpostNotConfiguredError(accountsQuery.error);
  const canPublish =
    !notConfigured &&
    !accountsQuery.isError &&
    selectedAccounts.length > 0 &&
    content.trim().length > 0 &&
    !publishMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-300">
        {t('broadcast.fbPageNotice')}
      </div>

      {/* Quick promotion presets when opened standalone */}
      {!promotion && availablePromotions.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">
            {t('broadcast.fbPromoPrefillLabel')}
          </p>
          <div className="flex flex-wrap gap-2">
            {availablePromotions.slice(0, 8).map((promo) => (
              <button
                key={promo.code}
                type="button"
                onClick={() => handleSelectPromo(promo)}
                className={`rounded-md border px-2.5 py-1 text-xs font-mono transition-colors ${
                  selectedPromoCode === promo.code
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border bg-surface text-foreground hover:bg-muted/10'
                }`}
              >
                {promo.code} (-{promo.percent}%)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Facebook Page accounts */}
      <div>
        <p className="mb-1.5 text-sm font-medium text-foreground">
          {t('broadcast.fbAccountsLabel')}
        </p>
        {accountsQuery.isLoading && (
          <p className="text-sm text-muted">{t('broadcast.fbAccountsLoading')}</p>
        )}
        {notConfigured && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
            <AlertCircle size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>{t('broadcast.fbNotConfigured')}</span>
          </div>
        )}
        {accountsQuery.isError && !notConfigured && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            <AlertCircle size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>{t('broadcast.fbAccountsError', { message: accountsQuery.error.message })}</span>
          </div>
        )}
        {!accountsQuery.isLoading && !accountsQuery.isError && fbAccounts.length === 0 && (
          <div role="status" className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">
            {t('broadcast.fbNoAccounts')}
          </div>
        )}
        {!accountsQuery.isLoading && !accountsQuery.isError && fbAccounts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {fbAccounts.map((acc) => {
              const checked = selectedAccounts.includes(acc.id);
              return (
                <label
                  key={acc.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    checked
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border bg-surface text-foreground hover:bg-muted/10'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAccount(acc.id)}
                  />
                  <span>{acc.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Content textarea + generator */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label htmlFor="fb-promo-content" className="text-sm font-medium text-foreground">
            {t('broadcast.fbContentLabel')}
          </label>
          {selectedPromoCode && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
            >
              <Sparkles size={14} aria-hidden="true" className="mr-1 inline-block" />
              {generateMutation.isPending ? t('broadcast.fbGenerating') : t('broadcast.fbGenerateBtn')}
            </Button>
          )}
        </div>
        <textarea
          id="fb-promo-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          placeholder={t('broadcast.fbContentPlaceholder')}
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <p className="mt-1 text-xs text-muted">
          {t('broadcast.charCount', { count: content.length })}
        </p>
        {generateMutation.isError && (
          <p role="alert" className="mt-1 text-xs text-red-400">
            {generateMutation.error.message}
          </p>
        )}
      </div>

      {/* Optional schedule */}
      <Input
        label={t('broadcast.fbScheduleLabel')}
        type="datetime-local"
        value={scheduledLocal}
        onChange={(e) => setScheduledLocal(e.target.value)}
      />

      {/* Publish error or success */}
      {publishMutation.isError && (
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <p className="font-medium">{t('broadcast.fbPublishError')}</p>
          <p className="text-xs">{publishMutation.error.message}</p>
        </div>
      )}

      {publishMutation.isSuccess && publishMutation.data?.postId !== undefined && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          <CheckCircle size={18} aria-hidden="true" className="shrink-0" />
          <span>
            {scheduledLocal
              ? t('broadcast.fbScheduleSuccess', { postId: String(publishMutation.data.postId) })
              : t('broadcast.fbPublishSuccess', { postId: String(publishMutation.data.postId) })}
          </span>
        </div>
      )}

      <Button
        onClick={handlePublish}
        disabled={!canPublish}
        loading={publishMutation.isPending}
        className="w-full"
      >
        <Share2 size={16} aria-hidden="true" className="mr-1.5 inline-block" />
        {publishMutation.isPending
          ? t('broadcast.fbPublishing')
          : scheduledLocal
            ? t('broadcast.fbSchedulePost')
            : t('broadcast.fbPublishNow')}
      </Button>
    </div>
  );
}
