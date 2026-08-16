/**
 * AppleGooglePay — Payment Request API integration.
 * Detects Apple Pay / Google Pay support, renders native payment buttons.
 * Falls back to null when unsupported.
 *
 * Requires backend endpoint POST /api/payments/payment-request to process
 * the PaymentResponse payment token.
 */
import { useEffect, useState, useCallback } from 'react';
import { API_BASE } from '@/lib/api-client';

interface PaymentMethodData {
  supportedMethods: string;
  data?: Record<string, unknown>;
}

interface AppleGooglePayProps {
  total: number;
  currency?: string;
  label?: string;
  onSuccess?: (orderId: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

const SUPPORTED_METHODS: PaymentMethodData[] = [
  {
    supportedMethods: 'https://apple.com/apple-pay',
    data: {
      version: 3,
      merchantIdentifier: 'merchant.com.auracafe',
      merchantCapabilities: ['supports3DS'],
      supportedNetworks: ['visa', 'masterCard', 'amex'],
      countryCode: 'VN',
    },
  },
  {
    supportedMethods: 'https://google.com/pay',
    data: {
      apiVersion: 2,
      apiVersionMinor: 0,
      merchantId: 'auracafe-merchant-id',
      allowedPaymentMethods: [{
        type: 'CARD',
        parameters: {
          allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
          allowedCardNetworks: ['VISA', 'MASTERCARD', 'AMEX'],
        },
        tokenizationSpecification: {
          type: 'PAYMENT_GATEWAY',
          parameters: { gateway: 'payos', gatewayMerchantId: 'auracafe' },
        },
      }],
    },
  },
];

export function AppleGooglePay({
  total,
  currency = 'VND',
  label = 'AURA CAFE',
  onSuccess,
  onError,
  disabled = false,
}: AppleGooglePayProps) {
  const [canPay, setCanPay] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!('PaymentRequest' in window)) return;
    // Check if any supported method is available
    const pr = new PaymentRequest(SUPPORTED_METHODS, {
      total: { label, amount: { currency, value: String(total) } },
    });
    pr.canMakePayment().then((result) => {
      setCanPay(result);
    }).catch(() => {
      setCanPay(false);
    });
  }, [total, currency, label]);

  const handlePay = useCallback(async () => {
    if (processing || disabled) return;
    setProcessing(true);

    try {
      const pr = new PaymentRequest(SUPPORTED_METHODS, {
        total: { label, amount: { currency, value: String(total) } },
      });

      const canPayNow = await pr.canMakePayment();
      if (!canPayNow) {
        onError?.('Thanh toán không khả dụng trên thiết bị này');
        setProcessing(false);
        return;
      }

      const response = await pr.show();
      // Send payment token to backend
      const res = await fetch(`${API_BASE}/api/payments/payment-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_token: response.details,
          amount: total,
          currency,
        }),
      });

      const result = await res.json();
      if (result.success && result.order_id) {
        await response.complete('success');
        onSuccess?.(result.order_id);
      } else {
        await response.complete('fail');
        onError?.(result.error || 'Thanh toán thất bại');
      }
    } catch (err) {
      // User cancelled or error
      if (err instanceof Error && err.name !== 'AbortError') {
        onError?.(err.message || 'Lỗi thanh toán');
      }
    } finally {
      setProcessing(false);
    }
  }, [total, currency, label, processing, disabled, onSuccess, onError]);

  if (!canPay) return null;

  // Determine which method is available for button label
  const isApplePay = SUPPORTED_METHODS.some((m) => m.supportedMethods.includes('apple'));

  return (
    <button
      type="button"
      onClick={handlePay}
      disabled={processing || disabled}
      className={`w-full flex items-center justify-center gap-2 rounded-xl px-5 py-3
        font-medium text-sm transition-all duration-200 cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
        ${isApplePay
          ? 'bg-black text-white hover:bg-gray-900 active:scale-[0.98]'
          : 'bg-white text-gray-900 hover:bg-gray-100 active:scale-[0.98] border border-gray-200'
        }`}
    >
      {processing ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : isApplePay ? (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
          Apple Pay
        </>
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="#4285F4"/>
            <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133l2.96 2.307C21.66 18.467 24 15.627 24 12c0-1.44-.24-2.827-.68-4.08h-10.84z" fill="#34A853" transform="translate(-11.52, 0)"/>
            <path d="M5.28 14.28c-.293-.88-.46-1.827-.46-2.76s.167-1.88.453-2.76L2.32 6.44C1.493 8.08 1 9.98 1 12s.493 3.92 1.32 5.56l2.96-2.28z" fill="#FBBC05" transform="translate(1.32, 0)"/>
            <path d="M12.48 4.8c1.413 0 2.68.48 3.68 1.44l2.76-2.76C17.48 1.68 15.16.8 12.48.8 8.86.8 5.707 2.867 3.88 6.04l3.413 2.64c.853-2.533 3.267-4.08 5.187-3.68z" fill="#EA4335" transform="translate(1.32, 0)"/>
          </svg>
          Google Pay
        </>
      )}
    </button>
  );
}
