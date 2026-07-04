import { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { XCircle, Clock, CreditCard, Wifi, Lock, Phone, MessageCircle, Timer } from 'lucide-react';
import { useOrderStore } from '@/hooks/stores/use-order-store';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

function getErrorMessages(t: (key: string) => string): Record<string, string> {
  return {
    '24': t('error24'),
    '51': t('error51'),
    '85': t('error85'),
    '99': t('error99'),
    '100': t('error100'),
    FAIL: t('errorFail'),
  };
}

function getErrorMessage(code: string | null, t: (key: string) => string): string {
  if (!code) return t('unknownReason');
  return getErrorMessages(t)[code] || `${t('errorCode')} ${code}`;
}

export function OrderFailurePage() {
  const { t } = useTranslation('order');
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const errorCode = searchParams.get('error');
  const responseCode = searchParams.get('responseCode');

  const { currentOrder, fetchOrder } = useOrderStore();

  // Fetch order details if orderId present
  useEffect(() => {
    if (orderId) {
      fetchOrder(orderId);
    }
  }, [orderId, fetchOrder]);

  const reason = responseCode
    ? getErrorMessage(responseCode, t)
    : errorCode
      ? decodeURIComponent(errorCode)
      : t('unknownReason');

  const handleRetry = () => {
    const target = orderId ? `/checkout?retry=true&order_id=${orderId}` : '/menu';
    window.location.href = target;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050D1A] via-[#0A1A2E] to-[#0F172A]">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Failure card */}
        <div className="rounded-2xl border border-red-500/10 bg-gradient-to-br from-[#0A1A2E]/80 to-[#050D1A]/90 p-8 text-center backdrop-blur-sm">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
            <XCircle className="h-10 w-10 text-red-400" />
          </div>

          <h1 className="mb-2 font-display text-3xl font-bold text-chrome-bright">
            {t('failureTitle')}
          </h1>
          <p className="mb-4 text-chrome-light/70">
            {t('failureDesc')}
          </p>
          <p className="mb-6 text-sm text-chrome-light/50">
             <Clock size={16} className="inline mr-1" /> {t('failureSupport')}
          </p>

          {/* Error reason */}
          <div className="mb-8 rounded-xl border border-red-500/10 bg-red-500/5 p-4">
            <p className="text-sm text-red-300">
              {t('errorReason')}: <span className="font-semibold">{reason}</span>
            </p>
          </div>

          {/* Order info */}
          {(orderId || currentOrder) && (
            <div className="mb-8 rounded-xl border border-chrome-light/10 bg-[#0A1A2E]/50 p-6 text-left">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-chrome-light/50">{t('orderId')}</span>
                  <span className="text-sm font-semibold text-chrome-bright">#{currentOrder?.id || orderId}</span>
                </div>
                {currentOrder && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-chrome-light/50">{t('total')}</span>
                      <span className="text-sm font-semibold text-chrome-bright">
                        {new Intl.NumberFormat('vi-VN').format(currentOrder.total) + '₫'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-chrome-light/50">{t('status')}</span>
                      <span className="text-sm text-chrome-light/80">
                        {currentOrder.status === 'pending' ? t('pendingPayment') : currentOrder.status}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mb-8 flex flex-wrap justify-center gap-3">
            <Button variant="primary" onClick={handleRetry}>
              {t('retry')}
            </Button>
            <Link to="/menu">
              <Button variant="secondary">{t('backToMenu')}</Button>
            </Link>
            <Link to="/">
              <Button variant="ghost">{t('goHome')}</Button>
            </Link>
          </div>

          {/* Common causes */}
          <div className="mb-8 rounded-xl border border-chrome-light/10 bg-[#0A1A2E]/50 p-6 text-left">
            <h3 className="mb-4 font-display text-lg font-semibold text-chrome-bright">
              {t('commonCausesTitle')}
            </h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-chrome-light"></span>
                <p className="text-sm text-chrome-light/70">
                  {t('causeInsufficientBalance')}
                </p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-chrome-light"></span>
                <p className="text-sm text-chrome-light/70">
                  {t('causeNetwork')}
                </p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-chrome-light"><Timer size={18} aria-hidden="true" /></span>
                <p className="text-sm text-chrome-light/70">
                  {t('causeTimeout')}
                </p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-chrome-light"></span>
                <p className="text-sm text-chrome-light/70">
                  {t('causeOtp')}
                </p>
              </div>
            </div>
          </div>

          {/* Contact support */}
          <div className="border-t border-chrome-light/10 pt-6">
            <p className="mb-3 text-sm font-semibold text-chrome-light/80">{t('needHelp')}</p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="tel:0946013633"
                className="text-sm text-chrome-light/60 hover:text-chrome-bright transition-colors"
              >
                 0946 013 633
              </a>
              <a
                href="https://zalo.me/0946013633"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-chrome-light/60 hover:text-chrome-bright transition-colors"
              >
                 Zalo
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
