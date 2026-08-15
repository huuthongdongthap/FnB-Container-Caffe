/**
 * BroadcastPage — confirmation modal before sending
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { FileText, AlertTriangle, Check } from 'lucide-react';
import type { Channel } from './BroadcastPage-types';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  segmentName: string;
  customerCount: number;
  channel: Channel;
  channelLabel: string;
  title: string;
  message: string;
  isPending: boolean;
}

export function BroadcastConfirmModal({
  open,
  onClose,
  onConfirm,
  segmentName,
  customerCount,
  channel,
  channelLabel,
  title,
  message,
  isPending,
}: ConfirmModalProps) {
  const { t } = useTranslation();

  return (
    <Modal open={open} onClose={onClose} title={t('broadcast.confirmTitle')}>
      <div className="space-y-4">
        <div className="rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-800">
          <p className="font-medium"><FileText size={20} aria-hidden="true" className="mr-1 inline-block" /> {t('broadcast.details')}</p>
          <ul className="mt-2 space-y-1 text-muted">
            <li>
              {t('broadcast.segment')}: <strong>{segmentName}</strong>
            </li>
            <li>
              {t('broadcast.quantity')}: <strong>{customerCount.toLocaleString('vi-VN')}</strong> {t('broadcast.customers')}
            </li>
            <li>
              {t('broadcast.channel')}: <strong>{channelLabel}</strong>
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
            onClick={onConfirm}
            loading={isPending}
            disabled={isPending}
            className="flex-1"
          >
            {isPending ? t('broadcast.sending') : <><Check size={20} aria-hidden="true" className="mr-1 inline-block" /> {t('broadcast.confirm')}</>}
          </Button>
          <Button
            onClick={onClose}
            variant="secondary"
            disabled={isPending}
            className="flex-1"
          >
            {t('broadcast.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
