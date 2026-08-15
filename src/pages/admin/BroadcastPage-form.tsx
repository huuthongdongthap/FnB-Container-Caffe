/**
 * BroadcastPage — form body (segment, channel, title, message, preview, send)
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, FileText } from 'lucide-react';
import { CHANNEL_OPTIONS } from './BroadcastPage-constants';
import type { Channel } from './BroadcastPage-types';

interface Segment {
  id: string;
  name: string;
  count: number;
}

interface FormProps {
  segment: string;
  setSegment: (v: string) => void;
  channel: Channel;
  setChannel: (v: Channel) => void;
  title: string;
  setTitle: (v: string) => void;
  message: string;
  setMessage: (v: string) => void;
  segments: Segment[];
  segmentsLoading: boolean;
  isFormValid: boolean;
  previewText: string;
  isPending: boolean;
  hasData: boolean;
  onOpenConfirm: () => void;
  onReset: () => void;
}

export function BroadcastForm({
  segment,
  setSegment,
  channel,
  setChannel,
  title,
  setTitle,
  message,
  setMessage,
  segments,
  segmentsLoading,
  isFormValid,
  previewText,
  isPending,
  hasData,
  onOpenConfirm,
  onReset,
}: FormProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardBody className="space-y-5">
        {/* Segment selector */}
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

        {/* Channel selector */}
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

        {/* Title input */}
        <Input
          label={t('broadcast.titleLabel')}
          placeholder={t('broadcast.titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {/* Message textarea */}
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

        {/* Preview */}
        {previewText && (
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            <FileText size={20} aria-hidden="true" className="mr-1 inline-block" /> {previewText}
          </div>
        )}

        {/* Send button */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={onOpenConfirm}
            disabled={!isFormValid || isPending}
            loading={isPending}
            size="lg"
            className="w-full"
          >
            {isPending ? t('broadcast.sending') : <><Send size={20} aria-hidden="true" className="mr-1 inline-block" /> {t('broadcast.send')}</>}
          </Button>
          {hasData && (
            <Button onClick={onReset} variant="secondary">
              {t('broadcast.sendAgain')}
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
