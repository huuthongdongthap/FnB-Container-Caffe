/**
 * BroadcastPage — result view shown after broadcast is sent
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle } from 'lucide-react';

interface BroadcastResult {
  pending?: boolean;
  total?: number;
  channels?: string[];
  skipped?: Record<string, string>;
  sent_count?: number;
  failed_count?: number;
}

interface ResultViewProps {
  result: BroadcastResult;
  onReset: () => void;
}

export function BroadcastResultView({ result, onReset }: ResultViewProps) {
  const { t } = useTranslation();

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
              <Button onClick={onReset} variant="secondary">
                {t('broadcast.sendAgain')}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
