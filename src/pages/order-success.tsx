/**
 * OrderSuccessPage — Order confirmation screen for AURA CAFE
 *
 * Stitch design: nocturnal nebula WebGL background, dark navy glassmorphism,
 * chrome/silver + warm bronze accent colors.
 *
 * Source: stitch-exports/order-success/design.html
 *
 * Features:
 * - Full-screen WebGL nebula shader background (from Stitch design)
 * - Animated success checkmark with pulse ring
 * - Glass card with order summary (ID, total, payment, status)
 * - Status progress tracker (pending -> confirmed -> preparing -> ready -> delivered)
 * - Next steps list
 * - SSE subscription with polling fallback (10 min timeout)
 * - Loading, error, empty states
 * - Contact links (phone, Zalo, SMS)
 * - Mobile-first responsive
 */

'use client';

import { useSearchParams, Link } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import {
  CheckCircle,
  Phone,
  MessageCircle,
  Mail,
  RefreshCw,
  AlertCircle,
  ShoppingBag,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrderStore } from '@/hooks/stores/use-order-store';
import { StatusProgressBar } from '@/components/order/status-progress-bar';
import { NextSteps } from '@/components/order/next-steps';

/* ---- Types --------------------------------------------------------- */

export interface OrderSuccessPageProps {
  locale?: string;
}

/* ---- CSS Variable helpers ------------------------------------------- */

const aura = (name: string) => `var(${name})`;

/* ---- Formatting ----------------------------------------------------- */

function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

/* ---- Status tracker config ------------------------------------------ */

const STATUS_STEPS: Array<{ key: string; label: string }> = [
  { key: 'pending', label: 'Chờ' },
  { key: 'confirmed', label: 'Xác nhận' },
  { key: 'preparing', label: 'Chế biến' },
  { key: 'ready', label: 'Sẵn sàng' },
  { key: 'delivered', label: 'Giao' },
];

const STATUS_MESSAGES: Record<string, string> = {
  pending: 'Đơn đã ghi nhận, chờ xác nhận',
  pending_payment: 'Thanh toán đang chờ xác nhận',
  awaiting_payment: 'Thanh toán đang chờ xác nhận',
  payment_pending: 'Thanh toán đang chờ xác nhận',
  paid: 'Thanh toán thành công',
  confirmed: 'Nhà hàng đã xác nhận',
  preparing: 'Đang chuẩn bị',
  ready: 'Sẵn sàng giao',
  delivering: 'Đang giao hàng',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

/* =====================================================================
   WebGL Nebula Shader Background (from Stitch design.html)
   ===================================================================== */

function NebulaBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const syncSize = () => {
      const w = canvas!.clientWidth || 1280;
      const h = canvas!.clientHeight || 720;
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
      }
    };

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(syncSize);
      ro.observe(canvas);
    }
    syncSize();

    const gl =
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return;

    const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

    const fs = `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    float noise = sin(uv.x * 3.0 + u_time * 0.15) * cos(uv.y * 2.0 - u_time * 0.1);
    vec3 color1 = vec3(0.02, 0.06, 0.1);
    vec3 color2 = vec3(0.01, 0.03, 0.05);

    vec3 finalColor = mix(color1, color2, noise * 0.5 + 0.5);

    float glimmer = pow(max(0.0, sin(uv.x * 10.0 + uv.y * 10.0 + u_time * 0.5)), 50.0);
    finalColor += vec3(0.8, 0.5, 0.3) * glimmer * 0.05;

    gl_FragColor = vec4(finalColor, 1.0);
}`;

    const cs = (type: number, src: string) => {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    };

    const prog = gl.createProgram()!;
    gl.attachShader(prog, cs(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, cs(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes = gl.getUniformLocation(prog, 'u_resolution');

    let animId: number;

    const render = (t: number) => {
      if (typeof ResizeObserver === 'undefined') syncSize();
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      if (uTime) gl!.uniform1f(uTime, t * 0.001);
      if (uRes) gl!.uniform2f(uRes, canvas!.width, canvas!.height);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      animId = requestAnimationFrame(render);
    };
    render(0);

    return () => {
      cancelAnimationFrame(animId);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 h-full w-full"
      style={{ display: 'block' }}
      aria-hidden="true"
    />
  );
}

/* =====================================================================
   Glass panel preset
   ===================================================================== */

const glassPanel: React.CSSProperties = {
  background: aura('--aura-glass-bg'),
  backdropFilter: `blur(${aura('--aura-glass-blur')})`,
  WebkitBackdropFilter: `blur(${aura('--aura-glass-blur')})`,
  border: `1px solid ${aura('--aura-glass-border')}`,
};

/* =====================================================================
   Loading Skeleton
   ===================================================================== */

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded${className ? ` ${className}` : ''}`}
      style={{ background: aura('--aura-glass-bg') }}
    />
  );
}

function SuccessSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading order status"
      className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-16"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <SkeletonBlock className="h-20 w-20 !rounded-full" />
        <SkeletonBlock className="h-8 w-56" />
        <SkeletonBlock className="h-4 w-72" />
        <SkeletonBlock className="h-2 w-full !rounded-full" />
        <SkeletonBlock className="h-48 w-full !rounded-xl" />
        <SkeletonBlock className="h-32 w-full !rounded-xl" />
        <div className="flex w-full gap-3">
          <SkeletonBlock className="h-12 flex-1 !rounded-lg" />
          <SkeletonBlock className="h-12 flex-1 !rounded-lg" />
        </div>
      </div>
    </section>
  );
}

/* =====================================================================
   Empty State
   ===================================================================== */

function EmptyState() {
  return (
    <section
      className="relative flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center"
      role="status"
    >
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: aura('--aura-glass-bg'),
          border: `1px solid ${aura('--aura-glass-border')}`,
        }}
      >
        <ShoppingBag
          className="h-10 w-10"
          style={{ color: aura('--aura-text-secondary') }}
        />
      </div>
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{
            fontFamily: aura('--aura-font-display'),
            color: aura('--aura-text-primary'),
          }}
        >
          Không tìm thấy đơn hàng
        </h1>
        <p className="mt-2 text-sm" style={{ color: aura('--aura-text-secondary') }}>
          Vui lòng kiểm tra lại mã đơn hàng hoặc quay lại menu để đặt hàng.
        </p>
      </div>
      <Link to="/menu">
        <Button variant="primary">Quay lại Menu</Button>
      </Link>
    </section>
  );
}

/* =====================================================================
   Error State
   ===================================================================== */

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <section
      className="relative flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center"
      role="alert"
    >
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: `color-mix(in srgb, ${aura('--aura-error')} 15%, transparent)`,
          border: `1px solid ${aura('--aura-error')}`,
        }}
      >
        <AlertCircle
          className="h-10 w-10"
          style={{ color: aura('--aura-error') }}
        />
      </div>
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{
            fontFamily: aura('--aura-font-display'),
            color: aura('--aura-text-primary'),
          }}
        >
          Có lỗi xảy ra
        </h1>
        <p
          className="mt-2 max-w-xs text-sm"
          style={{ color: aura('--aura-text-secondary') }}
        >
          {message}
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold uppercase tracking-widest transition-all hover:brightness-110 active:scale-95"
          style={{
            background: `linear-gradient(135deg, ${aura('--aura-primary')} 0%, ${aura('--aura-tertiary')} 100%)`,
            color: aura('--aura-bg-void'),
            fontFamily: aura('--aura-font-body'),
          }}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Thử lại
        </button>
      )}
      <Link to="/menu">
        <Button variant="ghost">Quay lại Menu</Button>
      </Link>
    </section>
  );
}

/* =====================================================================
   Main Component
   ===================================================================== */

export function OrderSuccessPage(_props: Readonly<OrderSuccessPageProps>) {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 min

  const { currentOrder, loading, error, fetchOrder, subscribeToOrder, unsubscribeFromOrder } =
    useOrderStore();

  const [pendingOrder, setPendingOrder] = useState<{
    id?: string;
    status?: string;
    total?: number;
    payment_method?: string;
  } | null>(null);

  const [pollingTimedOut, setPollingTimedOut] = useState(false);

  // Load cached pending order from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pendingOrder');
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        setPendingOrder({
          id: String(parsed.id ?? ''),
          status: String(parsed.status ?? ''),
          total: Number(parsed.total ?? 0),
          payment_method: String(parsed.payment_method ?? ''),
        });
        localStorage.removeItem('pendingOrder');
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Subscribe to SSE for real-time updates
  useEffect(() => {
    if (!orderId) return;

    fetchOrder(orderId);
    subscribeToOrder(orderId);

    const timeout = setTimeout(() => {
      setPollingTimedOut(true);
      unsubscribeFromOrder();
    }, POLL_TIMEOUT_MS);

    return () => {
      clearTimeout(timeout);
      unsubscribeFromOrder();
    };
  }, [orderId, fetchOrder, subscribeToOrder, unsubscribeFromOrder]);

  const order = currentOrder;
  const status = order?.status || pendingOrder?.status || 'pending';
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === status);

  const handleRetry = useCallback(() => {
    if (orderId) {
      fetchOrder(orderId);
      subscribeToOrder(orderId);
      setPollingTimedOut(false);
    }
  }, [orderId, fetchOrder, subscribeToOrder]);

  /* Loading */
  if (loading && !order) {
    return (
      <>
        <NebulaBackground />
        <SuccessSkeleton />
      </>
    );
  }

  /* Error */
  if (error && !order) {
    return (
      <>
        <NebulaBackground />
        <ErrorState message={error} onRetry={handleRetry} />
      </>
    );
  }

  /* Empty / No order ID */
  if (!order && !orderId && !pendingOrder) {
    return (
      <>
        <NebulaBackground />
        <EmptyState />
      </>
    );
  }

  return (
    <>
      <NebulaBackground />

      <div className="relative min-h-screen">
        <div className="mx-auto max-w-2xl px-4 py-12">
          {/* Success card */}
          <div
            className="rounded-2xl p-8 text-center"
            style={{
              ...glassPanel,
              boxShadow: `0 8px 32px rgba(0,0,0,0.5)`,
            }}
          >
            {/* Icon with pulse ring */}
            <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
              <span
                className="absolute inset-0 animate-ping rounded-full"
                style={{
                  border: `2px solid ${aura('--aura-success')}`,
                  opacity: 0.3,
                }}
              />
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full"
                style={{
                  background: `color-mix(in srgb, ${aura('--aura-success')} 12%, transparent)`,
                  boxShadow: `0 0 20px ${aura('--aura-success')}33`,
                }}
              >
                <CheckCircle
                  className="h-10 w-10"
                  style={{ color: aura('--aura-success') }}
                />
              </div>
            </div>

            <h1
              className="mb-2 text-3xl font-bold tracking-tight"
              style={{
                fontFamily: aura('--aura-font-display'),
                color: aura('--aura-primary'),
              }}
            >
              {order?.payment_method === 'payos' && status !== 'paid'
                ? 'Đơn hàng đang chờ thanh toán PayOS'
                : 'Đặt hàng thành công!'}
            </h1>
            <p
              className="mb-6"
              style={{ color: aura('--aura-text-secondary') }}
            >
              {order?.payment_method === 'payos' && status !== 'paid'
                ? 'Vui lòng hoàn tất thanh toán PayOS. Đơn chỉ được xác nhận sau khi webhook báo đã thanh toán.'
                : 'Cảm ơn bạn đã đặt hàng tại AURA CAFE. Chúng tôi sẽ liên hệ xác nhận trong vòng 5 phút.'}
            </p>

            {/* Polling timeout warning */}
            {pollingTimedOut && order?.payment_method === 'payos' && status !== 'paid' && (
              <div
                className="mb-6 rounded-lg border p-4 text-center"
                style={{
                  borderColor: `color-mix(in srgb, ${aura('--aura-tertiary')} 40%, transparent)`,
                  background: `color-mix(in srgb, ${aura('--aura-tertiary')} 8%, transparent)`,
                }}
              >
                <p
                  className="text-sm font-medium"
                  style={{ color: aura('--aura-tertiary') }}
                >
                  <Clock size={16} className="mr-1 inline" />
                  Đã quá 10 phút chưa nhận được xác nhận thanh toán
                </p>
                <p
                  className="mt-1 text-xs"
                  style={{ color: `color-mix(in srgb, ${aura('--aura-tertiary')} 70%, transparent)` }}
                >
                  Nếu bạn đã thanh toán, vui lòng liên hệ hỗ trợ để được kiểm tra.
                  Đơn hàng của bạn vẫn được ghi nhận.
                </p>
              </div>
            )}

            {/* Order info card */}
            <div
              className="mb-8 rounded-xl p-6 text-left"
              style={{
                background: `color-mix(in srgb, ${aura('--aura-bg-elevated')} 50%, transparent)`,
                border: `1px solid ${aura('--aura-glass-border')}`,
              }}
            >
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span
                    className="text-sm"
                    style={{ color: aura('--aura-text-secondary') }}
                  >
                    Mã đơn hàng
                  </span>
                  <span
                    className="text-sm font-semibold"
                    style={{
                      color: aura('--aura-primary'),
                      fontFamily: aura('--aura-font-mono'),
                    }}
                  >
                    #{order?.id || pendingOrder?.id || '---'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span
                    className="text-sm"
                    style={{ color: aura('--aura-text-secondary') }}
                  >
                    Tổng cộng
                  </span>
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: aura('--aura-tertiary') }}
                  >
                    {order
                      ? formatPrice(order.total)
                      : pendingOrder?.total
                        ? formatPrice(Number(pendingOrder.total))
                        : '---'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span
                    className="text-sm"
                    style={{ color: aura('--aura-text-secondary') }}
                  >
                    Phương thức
                  </span>
                  <span
                    className="text-sm"
                    style={{ color: aura('--aura-text-primary') }}
                  >
                    {order?.payment_method === 'cod'
                      ? 'Tiền mặt (COD)'
                      : order?.payment_method === 'payos'
                        ? 'PayOS'
                        : '---'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span
                    className="text-sm"
                    style={{ color: aura('--aura-text-secondary') }}
                  >
                    Trạng thái
                  </span>
                  <span
                    className="text-sm"
                    style={{ color: aura('--aura-text-primary') }}
                  >
                    {STATUS_MESSAGES[status] || status || 'Đang xử lý'}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Tracker */}
            <StatusProgressBar currentStep={currentStepIndex} steps={STATUS_STEPS} />

            {/* Next Steps */}
            <NextSteps />

            {/* Actions */}
            <div className="mb-8 flex flex-wrap justify-center gap-3">
              <Link to="/menu">
                <Button variant="secondary">Đặt thêm</Button>
              </Link>
              <Link to="/">
                <Button variant="primary">Về trang chủ</Button>
              </Link>
              {orderId && (
                <Link to={`/track-order?id=${orderId}`}>
                  <Button variant="ghost">Theo dõi đơn</Button>
                </Link>
              )}
            </div>

            {/* Contact */}
            <div
              className="border-t pt-6"
              style={{ borderColor: aura('--aura-glass-border') }}
            >
              <p
                className="mb-3 text-xs"
                style={{ color: aura('--aura-text-secondary') }}
              >
                Chưa nhận xác nhận? Liên hệ ngay:
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href="tel:0946013633"
                  className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors hover:brightness-110"
                  style={{
                    borderColor: aura('--aura-glass-border'),
                    color: aura('--aura-text-primary'),
                  }}
                >
                  <Phone size={14} />
                  Gọi
                </a>
                <a
                  href="https://zalo.me/0946013633"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors hover:brightness-110"
                  style={{
                    borderColor: `color-mix(in srgb, ${aura('--aura-secondary')} 30%, transparent)`,
                    color: aura('--aura-secondary'),
                  }}
                >
                  <MessageCircle size={14} />
                  Zalo
                </a>
                <a
                  href={`sms:0946013633?body=${encodeURIComponent('AURA CAFE - Mã đơn ' + (order?.id || ''))}`}
                  className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors hover:brightness-110"
                  style={{
                    borderColor: `color-mix(in srgb, ${aura('--aura-success')} 30%, transparent)`,
                    color: aura('--aura-success'),
                  }}
                >
                  <Mail size={14} />
                  SMS
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
