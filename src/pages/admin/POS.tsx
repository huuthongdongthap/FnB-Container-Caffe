/**
 * AURA CAFE — Point of Sale Terminal (Stitch Wrapper)
 *
 * Wraps the StitchPOSNew component with business logic hooks:
 * useMenu(), useCheckout(), useProcessPayOS() and payment/checkout state.
 * Overlays success/error status banners on top of the component.
 *
 * States: loading (delegated to StitchPOSNew), error (delegated to StitchPOSNew),
 *         empty (delegated to StitchPOSNew), populated
 */
'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import type { POSCustomer } from '@/hooks/use-pos-customer';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMenu } from '@/hooks/use-menu';
import { useCheckout, useProcessPayOS } from '@/hooks/use-checkout';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { CheckCircle2, AlertCircle, X, ExternalLink, RefreshCw, Banknote } from 'lucide-react';
import type { PaymentMethod } from '@/lib/validators';
import { brandConfig } from '@/config/brand-types';
import { StitchPOSNew } from '@/components/stitch/StitchPOSNew';
import { ShiftHandoverModal } from '@/components/admin/ShiftHandoverModal';
import { deriveShiftSlotLabel } from '@/pages/admin/staff-utils';
import type {
  POSNewMenuItem,
  POSNewCartItem,
  POSTableOption,
  POSActiveShift,
} from '@/components/stitch/StitchPOSNew-types';
import type { TodayResponse } from '@/hooks/stores/admin/admin-shifts-store-types';

interface CategoryApiRow {
  id: string;
  slug?: string | null;
  name: string;
  display_name_vi?: string | null;
}

interface TableApiRow {
  id: string;
  name?: string;
  code?: string;
  table_number?: number;
  status?: string;
  capacity?: number;
  seats?: number;
  zone?: string;
}

function sanitizePaymentUrl(rawUrl: string | undefined | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://auracafe.vn';
    const parsed = new URL(rawUrl.trim(), base);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/* ─── Main Page Component ────────────────────────────────────────────────── */
export default function AdminPOSPage() {
  /* ── Data Hooks ───────────────────────────────────────────────────── */
  const {
    data: menuData,
    isLoading: menuLoading,
    isError: menuIsError,
    error: menuError,
  } = useMenu({ available: true, limit: 100 });

  const checkoutMutation = useCheckout();
  const payOSMutation = useProcessPayOS();
  const { quarantinedCount } = useOfflineSync();
  const user = useAuthStore((s) => s.user);
  const activeTenant = user?.tenantId || 'default';
  const sessionVersion = useAuthStore((s) => s.sessionVersion);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: categoriesRes } = useQuery<{ success?: boolean; data?: CategoryApiRow[]; categories?: CategoryApiRow[] }>({
    queryKey: ['pos-categories', activeTenant, sessionVersion],
    queryFn: () => apiFetch('/api/categories', { silent: true }),
    staleTime: 60_000,
  });

  const { data: tablesRes } = useQuery<{ success?: boolean; data?: TableApiRow[]; tables?: TableApiRow[] }>({
    queryKey: ['pos-tables', activeTenant, sessionVersion],
    queryFn: () => apiFetch('/api/tables?limit=100', { silent: true }),
    staleTime: 15_000,
  });

  const { data: todayShiftsRes, refetch: refetchShifts } = useQuery<TodayResponse>({
    queryKey: ['pos-today-shifts', activeTenant, user?.id, sessionVersion],
    queryFn: () => apiFetch('/api/shifts/today', { silent: true }),
    staleTime: 15_000,
  });

  const categoryLabels = useMemo<Record<string, string>>(() => {
    const rows = Array.isArray(categoriesRes?.data)
      ? categoriesRes.data
      : Array.isArray(categoriesRes?.categories)
        ? categoriesRes.categories
        : [];
    const map: Record<string, string> = {};
    for (const row of rows) {
      const label = (row?.display_name_vi || row?.name || '').trim();
      if (!label) continue;
      if (row?.id) {
        map[row.id] = label;
      }
      if (row?.slug) {
        const slug = String(row.slug).trim();
        if (slug) {
          map[slug] = label;
          map[slug.toLowerCase()] = label;
        }
      }
    }
    return map;
  }, [categoriesRes]);

  const tables = useMemo<POSTableOption[]>(() => {
    const rows = Array.isArray(tablesRes?.data)
      ? tablesRes.data
      : Array.isArray(tablesRes?.tables)
        ? tablesRes.tables
        : [];
    return rows.map((row) => ({
      id: row.id,
      name: row.name || (row.table_number ? `Bàn ${row.table_number}` : row.code || row.id),
      code: row.code,
      status: row.status || 'Available',
      capacity: row.capacity ?? row.seats,
      zone: row.zone,
    }));
  }, [tablesRes]);

  const activeShift = useMemo<POSActiveShift | null>(() => {
    const shifts = Array.isArray(todayShiftsRes?.data) ? todayShiftsRes.data : [];
    const openShifts = shifts.filter((s) => Boolean(s.clock_in) && !s.clock_out);
    const chosen = user?.id ? openShifts.find((s) => s.staff_id === user.id) : openShifts[0];
    if (!chosen) return null;
    return {
      id: chosen.id,
      shiftName: deriveShiftSlotLabel(chosen.clock_in, chosen.shift),
      clockIn: chosen.clock_in,
      staffName: chosen.staff_name,
    };
  }, [todayShiftsRes, user?.id]);

  const canCollectCod = useMemo(() => {
    const normalizedRole = (user?.role || '').trim().toLowerCase();
    return ['owner', 'manager', 'supervisor', 'cashier', 'admin', 'waiter', 'shipper'].includes(normalizedRole);
  }, [user?.role]);

  /* ── Local State ──────────────────────────────────────────────────── */
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('payos');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('takeaway');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customer, setCustomer] = useState<POSCustomer | null>(null);
  const [useCashback, setUseCashback] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | undefined>(undefined);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [pendingCodOrder, setPendingCodOrder] = useState<{ id: string; total: number } | null>(null);
  const [codCollecting, setCodCollecting] = useState(false);
  const [codCollectedOrderId, setCodCollectedOrderId] = useState<string | null>(null);
  const [shiftHandoverOpen, setShiftHandoverOpen] = useState(false);
  const [shiftModalMode, setShiftModalMode] = useState<'open' | 'close' | 'auto'>('auto');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentQrPayload, setPaymentQrPayload] = useState<string | null>(null);
  const [paymentQrDataUrl, setPaymentQrDataUrl] = useState<string | null>(null);
  const [payOSModalOpen, setPayOSModalOpen] = useState(false);
  const [qrMode, setQrMode] = useState<'vietqr' | 'web'>('vietqr');
  const [qrInvalidated, setQrInvalidated] = useState(false);
  const [pendingPayOSOrder, setPendingPayOSOrder] = useState<{ orderId: string; total: number } | null>(null);
  const [deliveryRecipientName, setDeliveryRecipientName] = useState('');
  const [deliveryRecipientPhone, setDeliveryRecipientPhone] = useState('');
  const [isRetryingPayOS, setIsRetryingPayOS] = useState(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [cartResetKey, setCartResetKey] = useState(0);
  const [, setIsCompleting] = useState(false);
  const isCompletingRef = useRef(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCustomer(null);
    setUseCashback(false);
    setSelectedTableId(undefined);
    setOrderType('takeaway');
    setDeliveryAddress('');
    setDeliveryRecipientName('');
    setDeliveryRecipientPhone('');
    setPaymentUrl(null);
    setPaymentQrPayload(null);
    setPaymentQrDataUrl(null);
    setPayOSModalOpen(false);
    setQrInvalidated(false);
    setPendingPayOSOrder(null);
    setCheckoutError(null);
    setCheckoutSuccess(false);
    setPendingCodOrder(null);
    setCodCollectedOrderId(null);
  }, [activeTenant, sessionVersion]);

  const handleMarkCodPaid = useCallback(async (orderId: string) => {
    setCodCollecting(true);
    setCheckoutError(null);
    try {
      const res = await apiFetch<{ success?: boolean; error?: string }>(
        `/api/orders/${encodeURIComponent(orderId)}/mark-cod-paid`,
        { method: 'PATCH' },
      );
      if (res && res.success === false) {
        throw new Error(res.error || 'Không thể xác nhận đã thu tiền mặt');
      }
      setPendingCodOrder(null);
      setCodCollectedOrderId(orderId);
      setCheckoutSuccess(true);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        setCheckoutSuccess(false);
        setCodCollectedOrderId(null);
        successTimerRef.current = null;
      }, 5000);
    } catch (err) {
      setCheckoutError(
        err instanceof Error
          ? err.message
          : 'Không thể xác nhận đã thu tiền mặt (kiểm tra ca làm việc đang mở)',
      );
    } finally {
      setCodCollecting(false);
    }
  }, []);

  const hasEmvcoQr = Boolean(paymentQrPayload && !/^https?:\/\//i.test(paymentQrPayload));

  useEffect(() => {
    const qrSource = qrMode === 'web'
      ? paymentUrl
      : (hasEmvcoQr ? paymentQrPayload : paymentUrl);
    if (!qrSource || qrInvalidated) {
      setPaymentQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(qrSource, { width: 360, margin: 2 })
      .then((dataUrl) => {
        if (!cancelled) setPaymentQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setPaymentQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [paymentQrPayload, paymentUrl, qrMode, hasEmvcoQr, qrInvalidated]);

  useEffect(() => {
    if (!payOSModalOpen || !pendingPayOSOrder?.orderId) return;
    let cancelled = false;
    const orderId = pendingPayOSOrder.orderId;
    const pollOrderPayment = async () => {
      try {
        const res = await apiFetch<{
          order?: { status?: string; payment_status?: string; paymentStatus?: string; payment?: { status?: string }; payments?: Array<{ status?: string }> };
          data?: { status?: string; payment_status?: string; paymentStatus?: string; payment?: { status?: string }; payments?: Array<{ status?: string }> };
          status?: string;
          payment_status?: string;
          paymentStatus?: string;
          payment?: { status?: string };
          payments?: Array<{ status?: string }>;
        }>(`/api/orders/${encodeURIComponent(orderId)}`);
        if (cancelled) return;
        const orderObj = res?.order ?? res?.data ?? res;
        const payStatus = String(
          orderObj?.payment_status ?? orderObj?.paymentStatus ?? ''
        ).toLowerCase();
        const orderStatus = String(orderObj?.status ?? '').toLowerCase();
        const attemptStatus = String(
          orderObj?.payment?.status ?? orderObj?.payments?.[0]?.status ?? ''
        ).toLowerCase();

        if (payStatus === 'paid' || payStatus === 'completed') {
          setPayOSModalOpen(false);
          setPaymentUrl(null);
          setPaymentQrPayload(null);
          setQrInvalidated(false);
          setPendingPayOSOrder(null);
          setCheckoutError(null);
          setCartResetKey((k) => k + 1);
          setCheckoutSuccess(true);
          void queryClient.invalidateQueries({ queryKey: ['pos-tables'] });
          if (successTimerRef.current) clearTimeout(successTimerRef.current);
          successTimerRef.current = setTimeout(() => {
            setCheckoutSuccess(false);
            successTimerRef.current = null;
          }, 5000);
          return;
        }
        if (['cancelled', 'canceled', 'expired', 'failed'].includes(orderStatus)) {
          setPayOSModalOpen(false);
          setPaymentUrl(null);
          setPaymentQrPayload(null);
          setQrInvalidated(false);
          setPendingPayOSOrder(null);
          setCheckoutError('Đơn hàng đã bị hủy.');
          void queryClient.invalidateQueries({ queryKey: ['pos-tables'] });
          return;
        }
        if (['expired', 'cancelled', 'failed'].includes(attemptStatus)) {
          setQrInvalidated(true);
          setCheckoutError('Mã QR PayOS đã hết hạn hoặc bị hủy. Vui lòng bấm "Tạo lại QR" hoặc "Hủy đơn".');
        }
      } catch {
        // Ignore transient polling failures
      }
    };
    const intervalId = setInterval(() => {
      void pollOrderPayment();
    }, 3000);
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void pollOrderPayment();
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [payOSModalOpen, pendingPayOSOrder?.orderId, queryClient]);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  /* ── Derived Menu Data for StitchPOSNew ───────────────────────────── */
  const stitchMenuItems: POSNewMenuItem[] | undefined = menuData?.items?.map(
    (item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
      image: item.image_url,
    }),
  );

  /* ── Payment Handler ──────────────────────────────────────────────── */
  const handlePayment = useCallback((method: 'payos' | 'cod') => {
    setPaymentMethod(method);
  }, []);

  /* ── Checkout Handler ─────────────────────────────────────────────── */
  const handleCompleteOrder = useCallback(
    async (cart: POSNewCartItem[], total: number, tableId?: string) => {
      if (isCompletingRef.current) return false;
      isCompletingRef.current = true;

      setIsCompleting(true);
      setCheckoutError(null);
      setCheckoutSuccess(false);
      setPaymentUrl(null);
      setPaymentQrPayload(null);
      setPendingPayOSOrder(null);
      setPendingCodOrder(null);
      setCodCollectedOrderId(null);

      // Use tableId from POS component if provided, else fall back to state
      const resolvedTableId = tableId ?? selectedTableId;

      try {
        const effectiveOrderType = orderType;
        if (effectiveOrderType === 'delivery' && !deliveryAddress.trim()) {
          setCheckoutError('Vui lòng nhập địa chỉ giao hàng trước khi tạo đơn.');
          return false;
        }
        if (effectiveOrderType === 'dine_in' && !resolvedTableId) {
          setCheckoutError('Vui lòng chọn bàn phục vụ trước khi tạo đơn.');
          return false;
        }
        const effectiveMethod: PaymentMethod = effectiveOrderType === 'delivery' ? 'payos' : paymentMethod;
        const totalQty = cart.reduce((sum, ci) => sum + ci.quantity, 0);
        const computedShippingFee = effectiveOrderType === 'delivery' && totalQty > 0 && totalQty < 2 ? 15_000 : 0;
        const subtotal = cart.reduce((acc, ci) => acc + ci.price * ci.quantity, 0);
        const serviceFee = Math.max(0, Math.round(total - subtotal - computedShippingFee));
        const rawAppliedCashback = useCashback && customer && customer.cashback_balance > 0
          ? Math.min(Math.floor(customer.cashback_balance), Math.round(total))
          : 0;
        const appliedCashback =
          effectiveMethod === 'payos' &&
          rawAppliedCashback > 0 &&
          Math.round(total) - rawAppliedCashback > 0 &&
          Math.round(total) - rawAppliedCashback < 1000
            ? Math.max(0, Math.round(total) - 1000)
            : rawAppliedCashback;
        const payableTotal = Math.max(0, Math.round(total) - appliedCashback);
        const result = await checkoutMutation.mutateAsync({
          items: cart.map((ci) => ({
            id: ci.id,
            name: ci.name,
            price: ci.price,
            quantity: ci.quantity,
          })),
          total: payableTotal,
          customer_name:
            customer?.name ||
            (effectiveOrderType === 'delivery' && deliveryRecipientName.trim()
              ? deliveryRecipientName.trim()
              : t('adminPOS.customerDefaultName')),
          customer_phone:
            customer?.phone ||
            (effectiveOrderType === 'delivery' ? deliveryRecipientPhone.trim() : ''),
          customer_id: customer?.id,
          customer_email: undefined,
          customer_address:
            effectiveOrderType === 'dine_in'
              ? t('adminPOS.customerDefaultAddress')
              : effectiveOrderType === 'delivery'
                ? deliveryAddress.trim()
                : '',
          order_type: effectiveOrderType,
          payment_method: effectiveMethod,
          shipping_fee: computedShippingFee,
          service_fee: serviceFee,
          discount: 0,
          tip: 0,
          ...(appliedCashback > 0 ? { use_cashback: true, cashback_amount: appliedCashback } : {}),
          ...(effectiveOrderType === 'dine_in' && resolvedTableId ? { table_id: resolvedTableId } : {}),
        });

        if (result.success) {
          let resolvedUrl = result.payment_url || result.checkout_url;
          let resolvedQrCode: string | null = null;
          const createdOrderId = result.order_id || result.order?.id;
          const serverTotal = Math.round(result.order?.total ?? result.order?.totalAmount ?? payableTotal);

          if (effectiveMethod === 'payos' && serverTotal > 0) {
            if (!createdOrderId) {
              setCheckoutError(t('adminPOS.createOrderError'));
              return false;
            }
            if (!resolvedUrl) {
              try {
                const payRes = await payOSMutation.mutateAsync({
                  order_id: createdOrderId,
                  total: serverTotal,
                  cancel_url: window.location.href,
                  return_url: window.location.href,
                  description: `POS #${createdOrderId.slice(0, 8)}`,
                });
                resolvedUrl = payRes.payment_url || payRes.checkout_url || payRes.checkoutUrl || payRes.data?.checkoutUrl || payRes.data?.payment_url;
                resolvedQrCode = payRes.qrCode || payRes.qr_code || payRes.qrCodeUrl || payRes.data?.qrCode || payRes.data?.qrCodeUrl || null;
              } catch (payErr) {
                setPendingPayOSOrder({ orderId: createdOrderId, total: serverTotal });
                setCheckoutError(
                  payErr instanceof Error
                    ? payErr.message
                    : 'Không thể tạo mã QR PayOS. Vui lòng thử tạo lại hoặc hủy đơn.'
                );
                return false;
              }
            }
            const safeUrl = sanitizePaymentUrl(resolvedUrl);
            if (!safeUrl) {
              setPendingPayOSOrder({ orderId: createdOrderId, total: serverTotal });
              setCheckoutError('Không nhận được liên kết thanh toán PayOS hợp lệ. Vui lòng thử lại.');
              return false;
            }
            setPendingPayOSOrder({ orderId: createdOrderId, total: serverTotal });
            setPaymentQrPayload(resolvedQrCode);
            setPaymentUrl(safeUrl);
            setQrMode(resolvedQrCode ? 'vietqr' : 'web');
            setQrInvalidated(false);
            setPayOSModalOpen(true);
            setCustomer(null);
            setUseCashback(false);
            setSelectedTableId(undefined);
            setOrderType('takeaway');
            setDeliveryAddress('');
            setDeliveryRecipientName('');
            setDeliveryRecipientPhone('');
            if (resolvedTableId) {
              void queryClient.invalidateQueries({ queryKey: ['pos-tables'] });
            }
            return true;
          }

          setCustomer(null);
          setUseCashback(false);
          setSelectedTableId(undefined);
          setOrderType('takeaway');
          setDeliveryAddress('');
          setDeliveryRecipientName('');
          setDeliveryRecipientPhone('');
          if (resolvedTableId) {
            void queryClient.invalidateQueries({ queryKey: ['pos-tables'] });
          }
          const needsCodCollection = canCollectCod && effectiveMethod === 'cod' && Boolean(createdOrderId) && serverTotal > 0;
          if (needsCodCollection && createdOrderId) {
            setPendingCodOrder({ id: createdOrderId, total: serverTotal });
          } else {
            setPendingCodOrder(null);
          }
          setCheckoutSuccess(true);
          if (successTimerRef.current) {
            clearTimeout(successTimerRef.current);
          }
          if (!needsCodCollection) {
            successTimerRef.current = setTimeout(() => {
              setCheckoutSuccess(false);
              successTimerRef.current = null;
            }, 5000);
          }
          return true;
        } else {
          setCheckoutError(
            result.message || t('adminPOS.createOrderError'),
          );
          return false;
        }
      } catch (err) {
        setCheckoutError(
          err instanceof Error ? err.message : t('adminPOS.createOrderError'),
        );
        return false;
      } finally {
        isCompletingRef.current = false;
        setIsCompleting(false);
      }
    },
    [paymentMethod, orderType, deliveryAddress, checkoutMutation.mutateAsync, payOSMutation.mutateAsync, customer, useCashback, selectedTableId, canCollectCod, queryClient, t, navigate],
  );

  const handleRetryPayOSLink = useCallback(async () => {
    if (!pendingPayOSOrder || isRetryingPayOS) return;
    setIsRetryingPayOS(true);
    setCheckoutError(null);
    try {
      const payRes = await payOSMutation.mutateAsync({
        order_id: pendingPayOSOrder.orderId,
        total: pendingPayOSOrder.total,
        cancel_url: window.location.href,
        return_url: window.location.href,
        description: `POS #${pendingPayOSOrder.orderId.slice(0, 8)}`,
        regenerate: true,
      } as Parameters<typeof payOSMutation.mutateAsync>[0]);
      const resolvedUrl = payRes.payment_url || payRes.checkout_url || payRes.checkoutUrl || payRes.data?.checkoutUrl || payRes.data?.payment_url;
      const resolvedQrCode = payRes.qrCode || payRes.qr_code || payRes.qrCodeUrl || payRes.data?.qrCode || payRes.data?.qrCodeUrl || null;
      const safeUrl = sanitizePaymentUrl(resolvedUrl);
      if (!safeUrl) {
        setCheckoutError('Không nhận được liên kết thanh toán PayOS hợp lệ.');
        return;
      }
      setPaymentQrPayload(resolvedQrCode);
      setPaymentUrl(safeUrl);
      setQrMode(resolvedQrCode ? 'vietqr' : 'web');
      setQrInvalidated(false);
      setPayOSModalOpen(true);
      setCustomer(null);
      setUseCashback(false);
      setSelectedTableId(undefined);
      setOrderType('takeaway');
      setDeliveryAddress('');
      setDeliveryRecipientName('');
      setDeliveryRecipientPhone('');
      void queryClient.invalidateQueries({ queryKey: ['pos-tables'] });
      setCartResetKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'ORDER_ALREADY_PAID') {
        setPayOSModalOpen(false);
        setPaymentUrl(null);
        setPaymentQrPayload(null);
        setQrInvalidated(false);
        setPendingPayOSOrder(null);
        setCheckoutError(null);
        setCheckoutSuccess(true);
        void queryClient.invalidateQueries({ queryKey: ['pos-tables'] });
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => {
          setCheckoutSuccess(false);
          successTimerRef.current = null;
        }, 5000);
        return;
      }
      if (err instanceof ApiClientError && err.status === 409) {
        setQrInvalidated(true);
        setCheckoutError('Phiên thanh toán PayOS đã đóng hoặc cần đối soát. Vui lòng thử tạo lại QR hoặc hủy đơn.');
        return;
      }
      setCheckoutError(err instanceof Error ? err.message : 'Thử tạo lại mã QR PayOS thất bại.');
    } finally {
      setIsRetryingPayOS(false);
    }
  }, [pendingPayOSOrder, isRetryingPayOS, payOSMutation, queryClient]);

  const handleCancelPendingOrder = useCallback(async () => {
    if (!pendingPayOSOrder || isCancellingOrder) return;
    setIsCancellingOrder(true);
    try {
      await apiFetch(`/api/orders/${encodeURIComponent(pendingPayOSOrder.orderId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      });
      setPayOSModalOpen(false);
      setPaymentUrl(null);
      setPaymentQrPayload(null);
      setQrInvalidated(false);
      setPendingPayOSOrder(null);
      setCheckoutError(null);
      void queryClient.invalidateQueries({ queryKey: ['pos-tables'] });
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Không thể hủy đơn hàng.');
    } finally {
      setIsCancellingOrder(false);
    }
  }, [pendingPayOSOrder, isCancellingOrder, queryClient]);

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className="relative min-h-screen">
      <StitchPOSNew
        key={`${activeTenant}:${sessionVersion}`}
        menuItems={stitchMenuItems}
        addOns={[]}
        categoryLabels={categoryLabels}
        tables={tables}
        selectedTableId={selectedTableId}
        onSelectTable={(tableId) => {
          setSelectedTableId(tableId);
        }}
        orderType={orderType}
        onOrderTypeChange={(nextType) => {
          setOrderType(nextType);
          if (nextType === 'delivery') {
            setPaymentMethod('payos');
          }
          if (nextType !== 'dine_in') {
            setSelectedTableId(undefined);
          }
        }}
        deliveryAddress={deliveryAddress}
        onDeliveryAddressChange={setDeliveryAddress}
        deliveryRecipientName={deliveryRecipientName}
        onDeliveryRecipientNameChange={setDeliveryRecipientName}
        deliveryRecipientPhone={deliveryRecipientPhone}
        onDeliveryRecipientPhoneChange={setDeliveryRecipientPhone}
        taxRate={0}
        staffName={user?.name || user?.email || undefined}
        staffRole={user?.role || undefined}
        activeShift={activeShift}
        onShiftAction={() => {
          setShiftModalMode(activeShift ? 'close' : 'open');
          setShiftHandoverOpen(true);
        }}
        onNavigate={(path) => navigate(path)}
        paymentMethod={paymentMethod === 'cod' ? 'cod' : 'payos'}
        loading={menuLoading}
        error={
          menuIsError
            ? menuError instanceof Error
              ? menuError.message
              : 'Failed to load menu. Check server connection.'
            : null
        }
        brandName={brandConfig.brand.nameShort}
        onCompleteOrder={handleCompleteOrder}
        onPayment={handlePayment}
        customer={customer}
        onCustomerFound={(c) => { setCustomer(c); setUseCashback(false); }}
        onClearCustomer={() => { setCustomer(null); setUseCashback(false); }}
        useCashback={useCashback}
        onToggleCashback={setUseCashback}
        onOpenSchedule={() => navigate('/admin/staff')}
        onEndShift={() => {
          setShiftModalMode(activeShift ? 'close' : 'open');
          setShiftHandoverOpen(true);
        }}
        cartResetKey={cartResetKey}
      />

      <ShiftHandoverModal
        isOpen={shiftHandoverOpen}
        mode={shiftModalMode}
        onClose={() => setShiftHandoverOpen(false)}
        onCompleted={() => {
          void refetchShifts();
        }}
      />

      {/* ── Quarantined Offline Orders Alert (MD3 Strict) ──────────────── */}
      {quarantinedCount > 0 && (
        <div
          role="alert"
          data-testid="pos-quarantined-banner"
          className="fixed bottom-16 right-4 lg:right-[25rem] z-[95] flex items-center gap-3 px-4 py-3 shadow-lg rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-[var(--md-sys-color-primary)]" />
          <span className="m3-body-medium text-sm font-medium">
            {t('adminPOS.quarantinedOrdersAlert', {
              count: quarantinedCount,
              defaultValue: `${quarantinedCount} đơn offline cần kiểm tra thủ công`,
            })}
          </span>
        </div>
      )}

      {/* ── Success Banner Overlay ─────────────────────────────────────── */}
      {(checkoutSuccess || pendingCodOrder) && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3 rounded-lg shadow-lg"
          style={{
            backgroundColor: 'rgba(76,175,80,0.95)',
            color: '#fff',
          }}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium">
            {codCollectedOrderId
              ? `Đã thu tiền mặt đơn #${codCollectedOrderId.slice(0, 8)}!`
              : t('adminPOS.orderCreatedSuccess', { defaultValue: 'Tạo đơn thành công!' })}
          </span>
          {pendingCodOrder && (
            <>
              {!activeShift && (
                <span className="text-xs text-amber-100 underline" data-testid="pos-cod-no-shift-warning">
                  Chưa mở ca — mở ca để ghi nhận đối soát tiền mặt
                </span>
              )}
              <button
                type="button"
                data-testid="pos-mark-cod-paid-btn"
                disabled={codCollecting}
                onClick={() => void handleMarkCodPaid(pendingCodOrder.id)}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60 cursor-pointer"
              >
                <Banknote className="w-3.5 h-3.5" />
                {codCollecting ? 'Đang xác nhận...' : 'Đã thu tiền mặt'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingCodOrder(null);
                  setCheckoutSuccess(false);
                }}
                aria-label="Dismiss COD banner"
                className="rounded px-1.5 py-0.5 text-xs text-white/90 hover:bg-white/20 cursor-pointer"
              >
                ×
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Minimized Pending PayOS Pill (prevents orphaned orders on close) ── */}
      {!payOSModalOpen && pendingPayOSOrder && (
        <div
          data-testid="pos-pending-payos-pill"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[95] flex items-center gap-3 px-4 py-2.5 rounded-full shadow-xl border border-amber-400/40 bg-[#0A1A2E]/95 text-white text-xs"
        >
          <span>
            Đơn <strong>#{pendingPayOSOrder.orderId.slice(0, 8)}</strong> đang chờ PayOS ({pendingPayOSOrder.total.toLocaleString('vi-VN')}₫)
          </span>
          <button
            type="button"
            onClick={() => {
              if (paymentUrl) {
                setPayOSModalOpen(true);
              } else {
                void handleRetryPayOSLink();
              }
            }}
            className="px-3 py-1 rounded-full bg-[#f2c08d] text-[#1a1008] font-semibold cursor-pointer hover:brightness-105"
          >
            Mở lại QR
          </button>
          <button
            type="button"
            disabled={isCancellingOrder}
            onClick={() => void handleCancelPendingOrder()}
            className="px-2.5 py-1 rounded-full bg-red-500/25 text-red-200 font-semibold cursor-pointer hover:bg-red-500/40 disabled:opacity-50"
          >
            Hủy đơn
          </button>
        </div>
      )}

      {/* ── Error Banner Overlay (only when PayOS modal is closed to prevent backdrop overlap) ── */}
      {checkoutError && !payOSModalOpen && (
        <div
          role="alert"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-3 px-5 py-3 rounded-lg shadow-lg max-w-xl"
          style={{
            backgroundColor: 'rgba(220,53,69,0.95)',
            color: '#fff',
          }}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-sm flex-1">{checkoutError}</span>
          {pendingPayOSOrder && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isRetryingPayOS}
                onClick={() => void handleRetryPayOSLink()}
                className="px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {isRetryingPayOS ? 'Đang tạo...' : 'Thử tạo lại QR'}
              </button>
              <button
                type="button"
                disabled={isCancellingOrder}
                onClick={() => void handleCancelPendingOrder()}
                className="px-2.5 py-1 rounded bg-black/25 hover:bg-black/40 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {isCancellingOrder ? 'Đang hủy...' : 'Hủy đơn'}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCheckoutError(null)}
            className="shrink-0 ml-1 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── PayOS Payment Link Modal (replaces window.open) ─────────── */}
      {payOSModalOpen && paymentUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Thanh toán PayOS"
        >
          <div
            className="flex flex-col items-center gap-3 px-6 py-5 rounded-xl shadow-2xl max-w-sm w-full text-center"
            style={{ backgroundColor: 'rgba(10,26,46,0.98)', border: '1px solid rgba(201,214,223,0.3)', color: '#fff' }}
          >
            <div className="w-full flex items-center justify-between">
              <span className="text-xs font-semibold text-[#C9D6DF] uppercase tracking-wider">Thanh toán PayOS</span>
              {pendingPayOSOrder && (
                <span className="text-[11px] text-amber-300 font-medium">
                  #{pendingPayOSOrder.orderId.slice(0, 8)} • Chờ thanh toán
                </span>
              )}
            </div>

            {checkoutError && (
              <div
                role="alert"
                data-testid="pos-payos-modal-error"
                className="w-full flex items-start gap-2 rounded-lg bg-red-500/20 border border-red-400/40 px-3 py-2 text-left text-xs text-red-100"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-300 mt-0.5" />
                <span className="flex-1">{checkoutError}</span>
                <button
                  type="button"
                  onClick={() => setCheckoutError(null)}
                  className="shrink-0 text-red-200 hover:text-white cursor-pointer"
                  aria-label="Đóng thông báo lỗi"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {hasEmvcoQr && (
              <div className="w-full grid grid-cols-2 gap-1.5 rounded-lg bg-white/5 p-1" role="tablist" aria-label="Chế độ mã QR">
                <button
                  type="button"
                  role="tab"
                  aria-selected={qrMode === 'vietqr'}
                  data-testid="pos-qr-mode-vietqr"
                  onClick={() => setQrMode('vietqr')}
                  className={`px-2 py-1.5 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                    qrMode === 'vietqr' ? 'bg-[#f2c08d] text-[#1a1008]' : 'text-[#C9D6DF] hover:text-white'
                  }`}
                >
                  VietQR (App Ngân hàng / Zalo)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={qrMode === 'web'}
                  data-testid="pos-qr-mode-web"
                  onClick={() => setQrMode('web')}
                  className={`px-2 py-1.5 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                    qrMode === 'web' ? 'bg-[#f2c08d] text-[#1a1008]' : 'text-[#C9D6DF] hover:text-white'
                  }`}
                >
                  Link thanh toán (Camera iPhone)
                </button>
              </div>
            )}

            <div className="relative rounded-lg bg-white p-3">
              {qrInvalidated ? (
                <div
                  data-testid="pos-qr-invalidated"
                  className="h-48 w-48 flex flex-col items-center justify-center gap-2 text-center text-xs text-slate-700 px-3"
                >
                  <AlertCircle className="w-7 h-7 text-red-500" />
                  <span className="font-semibold text-red-600">Mã QR không còn hiệu lực</span>
                  <span>Vui lòng bấm "Tạo lại QR" hoặc "Hủy đơn".</span>
                </div>
              ) : (
                paymentQrDataUrl && (
                  <img
                    src={paymentQrDataUrl}
                    alt={qrMode === 'web' ? 'PayOS Web Link QR Code' : 'PayOS VietQR Code'}
                    className="h-48 w-48 object-contain"
                  />
                )
              )}
            </div>

            <p className="text-[11px] text-[#C9D6DF]">
              {qrMode === 'web' || !hasEmvcoQr
                ? 'Dùng Camera iPhone hoặc trình duyệt quét để mở trang thanh toán PayOS.'
                : 'Mở App Ngân hàng hoặc Zalo để quét chuyển khoản nhanh.'}
            </p>

            <a
              href={paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 mt-0.5 px-4 py-2 rounded-full bg-[#6B9FB8] text-white text-sm font-bold hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="w-4 h-4" /> Mở trang thanh toán
            </a>
            {pendingPayOSOrder && (
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  disabled={isRetryingPayOS}
                  onClick={() => void handleRetryPayOSLink()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {isRetryingPayOS ? 'Đang tạo...' : 'Tạo lại QR'}
                </button>
                <button
                  type="button"
                  disabled={isCancellingOrder}
                  onClick={() => void handleCancelPendingOrder()}
                  className="px-3 py-1.5 rounded-full bg-red-500/20 hover:bg-red-500/35 text-xs font-semibold text-red-200 cursor-pointer disabled:opacity-50"
                >
                  {isCancellingOrder ? 'Đang hủy...' : 'Hủy đơn'}
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setPayOSModalOpen(false);
                setCheckoutError(null);
              }}
              className="text-xs text-[#8898A4] hover:text-white mt-1 cursor-pointer transition-colors"
            >
              Thu gọn (giữ đơn chờ)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
