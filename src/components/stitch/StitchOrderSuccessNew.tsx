/**
 * StitchOrderSuccessNew — Order success confirmation screen for AURA CAFE
 *
 * Regenerated from the original Stitch HTML export to match pixel-for-pixel:
 *   /tmp/stitch_original/stitch_aura_cafe/aura_cafe_order_success_confirmation/code.html
 *
 * Design tokens (inlined via Tailwind, matching original Stitch HTML config):
 *   primary (bronze): #f2bb98
 *   primary-container: #c49271
 *   chrome: #a1a1aa
 *   background (void): #09141e
 *   on-surface: #d8e4f2
 *   on-surface-variant: #d5c3b9
 *   glass: rgba(21,33,43,0.4) backdrop-blur-xl border rgba(161,161,170,0.2)
 *   Display font: 'EB Garamond', serif
 *   Body font: 'Space Grotesk', sans-serif
 */
'use client';

import type * as THREE from 'three';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';
import {
  ArrowLeft,
  UserCircle,
  Check,
  MapPin,
  AlertCircle,
  RefreshCw,
  Receipt,
} from 'lucide-react';
import { cn } from '@/lib/cn';

/* ─── Types ────────────────────────────────────────────────────────────────── */

export interface OrderSuccessNewItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface OrderSuccessNewData {
  orderId: string;
  items: OrderSuccessNewItem[];
  total: number;
  estimatedMinutes: number;
  locationName: string;
  locationImageUrl?: string;
  customerName?: string;
  table?: string;
}

export interface StitchOrderSuccessNewProps {
  order: OrderSuccessNewData | null;
  isLoading?: boolean;
  error?: string | null;
  locale?: string;
  currency?: 'VND' | 'USD';
  onTrackOrder?: () => void;
  onBack?: () => void;
  onAccount?: () => void;
  onRefresh?: () => void;
}

/* ─── Constants ────────────────────────────────────────────────────────────── */

const STATUS_STEPS = ['received', 'preparing', 'ready'] as const;

const PROGRESS_PERCENT = 50; // Matches HTML design: Received + Preparing active

/* ─── Glass panel style class (matches original HTML glass-card) ───────────── */

const glassPanelClasses =
  'bg-[rgba(21,33,43,0.4)] backdrop-blur-xl border border-[rgba(161,161,170,0.2)]';

/* ─── Price formatting ─────────────────────────────────────────────────────── */

function formatPrice(
  amount: number,
  localeStr: string,
  currencyType: 'VND' | 'USD',
): string {
  const isVietnamese = localeStr === 'vi' || localeStr.startsWith('vi');
  const cur = currencyType || (isVietnamese ? 'VND' : 'USD');
  return new Intl.NumberFormat(cur === 'VND' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: cur === 'VND' ? 0 : 2,
  }).format(amount);
}

/* ─── Animation Keyframes ──────────────────────────────────────────────────── */

const shineKeyframes = `
@keyframes shine {
  0% { transform: translateX(-100%) translateY(-100%); }
  100% { transform: translateX(100%) translateY(100%); }
}
@keyframes pulse-bronze {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.05); }
}
`;

/* ─── WebGL Shader Background (matches original ANIMATION_63) ──────────────── */

function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cvs = canvas;
    function syncSize() {
      const w = cvs.clientWidth || 1280;
      const h = cvs.clientHeight || 720;
      if (cvs.width !== w || cvs.height !== h) {
        cvs.width = w;
        cvs.height = h;
      }
    }

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(syncSize);
      ro.observe(cvs);
    }
    syncSize();

    const gl =
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return;
    const g = gl;

    const vs =
      'attribute vec2 a_position;' +
      'varying vec2 v_texCoord;' +
      'void main() {' +
      '  v_texCoord = a_position * 0.5 + 0.5;' +
      '  gl_Position = vec4(a_position, 0.0, 1.0);' +
      '}';
    const fs =
      'precision highp float;' +
      'uniform float u_time;' +
      'uniform vec2 u_resolution;' +
      'void main() {' +
      '    vec2 uv = gl_FragCoord.xy / u_resolution.xy;' +
      '    float noise = sin(uv.x * 3.0 + u_time * 0.2) * cos(uv.y * 2.0 - u_time * 0.15);' +
      '    vec3 color1 = vec3(0.02, 0.06, 0.1);' +
      '    vec3 color2 = vec3(0.01, 0.03, 0.05);' +
      '    vec3 finalColor = mix(color1, color2, noise * 0.5 + 0.5);' +
      '    float glimmer = pow(max(0.0, sin(uv.x * 10.0 + uv.y * 10.0 + u_time * 0.5)), 50.0);' +
      '    finalColor += vec3(0.8, 0.5, 0.3) * glimmer * 0.05;' +
      '    gl_FragColor = vec4(finalColor, 1.0);' +
      '}';

    function createShader(type: number, src: string) {
      const s = g.createShader(type)!;
      g.shaderSource(s, src);
      g.compileShader(s);
      return s;
    }

    const prog = g.createProgram()!;
    g.attachShader(prog, createShader(gl.VERTEX_SHADER, vs));
    g.attachShader(prog, createShader(gl.FRAGMENT_SHADER, fs));
    g.linkProgram(prog);
    g.useProgram(prog);

    const buf = gl.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, buf);
    g.bufferData(
      g.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      g.STATIC_DRAW,
    );

    const pos = g.getAttribLocation(prog, 'a_position');
    g.enableVertexAttribArray(pos);
    g.vertexAttribPointer(pos, 2, g.FLOAT, false, 0, 0);

    const uTime = g.getUniformLocation(prog, 'u_time');
    const uRes = g.getUniformLocation(prog, 'u_resolution');
    const uMouse = g.getUniformLocation(prog, 'u_mouse');

    const cvs2 = canvas;
    const mouse = { x: cvs2.width / 2, y: cvs2.height / 2 };

    function onMouseMove(event: MouseEvent) {
      const rect = cvs2.getBoundingClientRect();
      if (rect.width && rect.height) {
        const nx = (event.clientX - rect.left) / rect.width;
        const ny = 1.0 - (event.clientY - rect.top) / rect.height;
        mouse.x = nx * cvs2.width;
        mouse.y = ny * cvs2.height;
      }
    }
    window.addEventListener('mousemove', onMouseMove);

    let animId = 0;
    function render(t: number) {
      if (!ro) syncSize();
      const g2 = gl as WebGLRenderingContext;
      const cvs3 = canvas as HTMLCanvasElement;
      g2.viewport(0, 0, cvs3.width, cvs3.height);
      if (uTime) g2.uniform1f(uTime, t * 0.001);
      if (uRes) g2.uniform2f(uRes, cvs3.width, cvs3.height);
      if (uMouse) g2.uniform2f(uMouse, mouse.x, mouse.y);
      g2.drawArrays(g2.TRIANGLE_STRIP, 0, 4);
      animId = requestAnimationFrame(render);
    }
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouseMove);
      if (ro) ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full -z-10 opacity-60"
      style={{ display: 'block', width: '100%', height: '100%' }}
      aria-hidden="true"
    />
  );
}

/* ─── Three.js Ring Animation (matches original ANIMATION_64) ──────────────── */

function ThreeRingOverlay() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cnt = containerRef.current;
    if (!cnt) return;

    let animId = 0;
    let rendererInstance: THREE.WebGLRenderer | null = null;

    const script = document.createElement('script');
    script.src =
      'https://ajax.googleapis.com/ajax/libs/threejs/r125/three.min.js';
    script.onload = () => {
      const THREE = (window as unknown as { THREE: typeof import('three') })
        .THREE;

      const cnt2 = cnt;
      const width = cnt2.clientWidth || window.innerWidth;
      const height = cnt2.clientHeight || window.innerHeight;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.z = 5;

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
      });
      rendererInstance = renderer;
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      cnt2.appendChild(renderer.domElement);

      // Main ring - thin bronze torus
      const geometry = new THREE.TorusGeometry(1.5, 0.01, 16, 100);
      const material = new THREE.MeshBasicMaterial({
        color: 0xd4a574,
        transparent: true,
        opacity: 0.6,
      });
      const ring = new THREE.Mesh(geometry, material);
      scene.add(ring);

      // Second ring for depth
      const geometry2 = new THREE.TorusGeometry(1.55, 0.005, 16, 100);
      const material2 = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.2,
      });
      const ring2 = new THREE.Mesh(geometry2, material2);
      ring2.rotation.x = Math.PI / 2;
      scene.add(ring2);

      const c = cnt;
      function onWindowResize() {
        const w = c.clientWidth || window.innerWidth;
        const h = c.clientHeight || window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer!.setSize(w, h);
      }
      window.addEventListener('resize', onWindowResize);

      function animate() {
        animId = requestAnimationFrame(animate);
        const time = Date.now() * 0.001;

        ring.rotation.z += 0.005;
        ring.rotation.y = Math.sin(time * 0.5) * 0.2;

        const scale = 1.0 + Math.sin(time) * 0.05;
        ring.scale.set(scale, scale, scale);

        renderer.render(scene, camera);
      }
      animate();
    };
    document.head.appendChild(script);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', () => {});
      if (
        rendererInstance &&
        cnt.contains(rendererInstance.domElement)
      ) {
        cnt.removeChild(rendererInstance.domElement);
        rendererInstance.dispose();
      }
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

/* ─── Loading Skeleton ─────────────────────────────────────────────────────── */

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-[rgba(21,33,43,0.4)] backdrop-blur-xl',
        className,
      )}
    />
  );
}

function OrderSuccessNewSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading order confirmation"
      className="min-h-screen bg-[var(--aura-surface-dim)] pt-24 pb-16"
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-8 px-5">
        {/* Wait time skeleton */}
        <SkeletonBlock className="h-48 w-full rounded-[40px]" />
        {/* Order summary skeleton */}
        <SkeletonBlock className="h-48 w-full rounded-[24px]" />
        {/* Progress bar skeleton */}
        <SkeletonBlock className="h-12 w-full rounded-[24px]" />
        {/* Button skeleton */}
        <SkeletonBlock className="h-14 w-full" />
        {/* Location card skeleton */}
        <SkeletonBlock className="h-40 w-full rounded-[24px]" />
      </div>
    </section>
  );
}

/* ─── Error State ──────────────────────────────────────────────────────────── */

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="flex min-h-screen items-center justify-center bg-[var(--aura-surface-dim)] px-5"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex max-w-sm flex-col items-center gap-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--aura-error)_10%,transparent)] border border-[color-mix(in_oklab,var(--aura-error)_30%,transparent)]">
          <AlertCircle
            className="text-[var(--aura-error)]"
            size={40}
            aria-hidden="true"
          />
        </div>
        <div>
          <h2
            className="text-2xl font-medium text-[var(--aura-chrome-bright)]"
            style={{ fontFamily: "'EB Garamond', serif" }}
          >
            {t('stitch.orderSuccessError')}
          </h2>
          <p className="mt-2 text-sm text-[var(--aura-chrome-soft)]">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--aura-chrome-soft)] via-[var(--aura-chrome-dim)] to-[var(--aura-chrome-dim)] px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[var(--aura-chrome-bright)] shadow-xl transition-all hover:brightness-110 active:scale-95"
            aria-label={t('stitch.orderSuccessRetry')}
          >
            <RefreshCw className="text-sm" aria-hidden="true" />
            {t('stitch.orderSuccessRetry')}
          </button>
        )}
      </div>
    </section>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────────────── */

function EmptyState() {
  const { t } = useTranslation();
  return (
    <section
      className="flex min-h-screen items-center justify-center bg-[var(--aura-surface-dim)] px-5"
      role="status"
      aria-label={t('stitch.orderSuccessNotFound')}
    >
      <div className="flex max-w-sm flex-col items-center gap-6 text-center">
        <div
          className={cn(
            'flex h-20 w-20 items-center justify-center rounded-full',
            glassPanelClasses,
          )}
        >
          <Receipt className="text-[var(--aura-chrome-soft)]" size={40} aria-hidden="true" />
        </div>
        <div>
          <h2
            className="text-2xl font-medium text-[var(--aura-chrome-bright)]"
            style={{ fontFamily: "'EB Garamond', serif" }}
          >
            {t('stitch.orderSuccessNotFound')}
          </h2>
          <p className="mt-2 text-sm text-[var(--aura-chrome-soft)]">
            {t('stitch.orderSuccessNotFoundDesc')}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Wait Time Display ────────────────────────────────────────────────────── */

interface WaitTimeDisplayProps {
  estimatedMinutes: number;
}

function WaitTimeDisplay({ estimatedMinutes }: WaitTimeDisplayProps) {
  const { t } = useTranslation();
  return (
    <div className="w-full relative aspect-square flex flex-col items-center justify-center overflow-hidden rounded-[40px]">
      {/* Three.js 3D ring overlay (matching HTML ANIMATION_64) */}
      <div
        className="absolute inset-0 w-full h-full -z-10 scale-125 opacity-40"
        style={{ display: 'block' }}
        aria-hidden="true"
      >
        <ThreeRingOverlay />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center flex flex-col gap-1">
        <span className="text-[12px] leading-none font-bold uppercase tracking-[0.2em] text-[#c49271]">
          {t('stitch.orderSuccessNewEstimatedWait', {
            defaultValue: 'ESTIMATED WAIT',
          })}
        </span>

        <div
          className="flex items-baseline justify-center text-[84px] leading-none text-[var(--aura-chrome-bright)]"
          style={{ fontFamily: "'EB Garamond', serif" }}
        >
          {estimatedMinutes}
          <span className="text-2xl font-medium ml-2 uppercase tracking-widest text-[var(--aura-chrome-bright)]">
            {t('stitch.orderSuccessNewMin', { defaultValue: 'min' })}
          </span>
        </div>

        {/* Live status badge */}
        <div className="mt-2 px-4 py-1.5 rounded-full border border-[color-mix(in_oklab,var(--aura-chrome-bright)_30%,transparent)] bg-[color-mix(in_oklab,var(--aura-chrome-bright)_10%,transparent)] inline-flex items-center gap-2 self-center">
          <div className="w-2 h-2 rounded-full bg-[var(--aura-chrome-bright)] animate-[pulse-bronze_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#c49271]">
            {t('stitch.orderSuccessNewPreparingBrew', {
              defaultValue: 'PREPARING YOUR BREW',
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Order Summary Glass Card ─────────────────────────────────────────────── */

interface OrderSummaryCardProps {
  orderId: string;
  items: OrderSuccessNewItem[];
  total: number;
  formatFn: (amount: number) => string;
}

function OrderSummaryCard({
  orderId,
  items,
  total,
  formatFn,
}: OrderSummaryCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'w-full rounded-[24px] p-4 flex flex-col gap-4',
        glassPanelClasses,
      )}
      role="region"
      aria-label={t('stitch.orderSummary')}
    >
      {/* Header: Order ID + Total */}
      <div className="flex justify-between items-center border-b border-white/5 pb-2">
        <span className="text-[12px] leading-none font-bold uppercase tracking-[0.1em] text-[var(--aura-chrome-soft)]">
          {t('stitch.orderSuccessId', { defaultValue: 'ORDER' })} #
          {orderId}
        </span>
        <span
          className="text-2xl text-[var(--aura-chrome-bright)]"
          style={{ fontFamily: "'EB Garamond', serif" }}
          aria-label={`${t('stitch.orderSuccessTotal')}: ${formatFn(total)}`}
        >
          {formatFn(total)}
        </span>
      </div>

      {/* Items list */}
      <div
        className="flex flex-col gap-2"
        role="list"
        aria-label={t('stitch.selectedItems')}
      >
        {items.length === 0 ? (
          <p className="text-center text-sm text-[var(--aura-chrome-soft)]">
            {t('stitch.orderSuccessEmptyItems')}
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between items-center"
              role="listitem"
            >
              <div className="flex gap-2 items-center">
                <span className="text-[var(--aura-chrome-bright)] font-bold">
                  {item.quantity}x
                </span>
                <span className="text-sm text-[var(--aura-chrome-bright)]">{item.name}</span>
              </div>
              <span
                className="text-sm italic text-[var(--aura-chrome-soft)]"
                style={{ fontFamily: "'EB Garamond', serif" }}
              >
                {formatFn(item.price)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Divider between items and progress */}
      <div className="w-full h-px bg-white/5 my-1" />

      {/* Progress tracker (3 steps: Received -> Preparing -> Ready) */}
      <div className="flex flex-col gap-4 pt-2">
        {/* Progress track line */}
        <div className="relative w-full h-[2px] bg-white/10">
          {/* Active progress fill */}
          <div
            className="absolute h-full bg-[var(--aura-chrome-bright)] transition-all duration-700"
            style={{ width: `${PROGRESS_PERCENT}%` }}
          />

          {/* Step dots */}
          <div className="absolute top-1/2 left-0 -translate-y-1/2 flex justify-between w-full">
            {STATUS_STEPS.map((step, idx) => {
              const isCompleted = idx === 0; // "Received" is fully completed
              const isActive = idx === 1; // "Preparing" is current (pulsing)
              const isPending = idx === 2; // "Ready" is pending

              return (
                <div
                  key={step}
                  className={cn(
                    'w-4 h-4 rounded-full ring-4 ring-[var(--aura-surface-dim)] border-2 transition-all',
                    isCompleted &&
                      'bg-[var(--aura-chrome-bright)] border-white/20 flex items-center justify-center',
                    isActive &&
                      'bg-[#c49271] border-white/20 animate-[pulse-bronze_2s_cubic-bezier(0.4,0,0.6,1)_infinite]',
                    isPending && 'bg-white/5 border-white/10',
                  )}
                  role="img"
                  aria-label={`Step ${idx + 1}: ${step}`}
                >
                  {isCompleted && (
                    <Check
                      size={8}
                      className="text-[var(--aura-noir-deep)]"
                      style={{ strokeWidth: 3 }}
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step labels */}
        <div className="flex justify-between w-full px-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#c49271]">
            {t('stitch.orderSuccessStatusReceived', {
              defaultValue: 'RECEIVED',
            })}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#c49271]">
            {t('stitch.orderSuccessStatusPreparing', {
              defaultValue: 'PREPARING',
            })}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--aura-chrome-soft)]">
            {t('stitch.orderSuccessStatusReady', {
              defaultValue: 'READY',
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Chrome Gradient Button ────────────────────────────────────────────────── */

interface ChromeButtonProps {
  onClick?: () => void;
  label: string;
  ariaLabel?: string;
}

function ChromeButton({ onClick, label, ariaLabel }: ChromeButtonProps) {
  return (
    <button
      onClick={onClick}
      className="relative w-full overflow-hidden py-4 text-center text-[12px] leading-none font-bold uppercase tracking-[0.2em] text-[var(--aura-chrome-bright)] shadow-[0_10px_30px_rgba(196,146,113,0.1)] transition-transform active:scale-[0.98] rounded-none"
      style={{
        background: 'linear-gradient(180deg, #d4d4d8 0%, #a1a1aa 100%)',
      }}
      aria-label={ariaLabel ?? label}
    >
      {/* Shine animation overlay (matching HTML chrome-button::after) */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(45deg, transparent 45%, rgba(255,255,255,0.4) 50%, transparent 55%)',
          animation: 'shine 4s infinite',
        }}
        aria-hidden="true"
      />
      <span className="relative z-10">{label}</span>
    </button>
  );
}

/* ─── Location Card ────────────────────────────────────────────────────────── */

interface LocationCardProps {
  locationName: string;
  imageUrl?: string;
}

function LocationCard({ locationName, imageUrl }: LocationCardProps) {
  const { t } = useTranslation();
  const defaultImage =
    'https://lh3.googleusercontent.com/aida-public/AB6AXuB90p-HQ3qdJbW1M_x492UqW3HLs03n6XsrLpvu0QVEMyWAfjJXfgdukv-IePi8OLn_Qk9sRXhCB6TWZxQjiHd7x9Q-zKzEv3dC2jWN-rAGGQG1RdY0ZqNz8O3uN0qzYCM0SzE8jsiY0fnJpqyKmnBwU-X8AabgCNah__hRLDyWmhZiERlXaxI9lHVuvx09XcBxXH5agT7CFRnKpMCN0BX-7MEbyZ5crFzbW59kesuIm7l2ve_cVVnwUvWu9O6OVeVE7SMuo6ycupg';

  return (
    <div
      className={cn(
        'glass-card rounded-[24px] overflow-hidden w-full h-40 relative group cursor-pointer transition-all duration-500 hover:border-[color-mix(in_oklab,var(--aura-chrome-bright)_40%,transparent)]',
        glassPanelClasses,
      )}
      role="region"
      aria-label={`${t('stitch.orderSuccessNewLocation')}: ${locationName}`}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-110"
        style={{ backgroundImage: `url('${imageUrl || defaultImage}')` }}
        role="img"
        aria-label={locationName}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-surface-dim)] to-transparent opacity-80" />

      {/* Location label */}
      <div className="absolute bottom-4 left-4 flex flex-col z-10">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#c49271]">
          {t('stitch.orderSuccessNewLocation', {
            defaultValue: 'LOCATION',
          })}
        </span>
        <span className="text-2xl font-medium text-[var(--aura-chrome-bright)]">
          {locationName}
        </span>
      </div>

      {/* Map icon */}
      <div className="absolute top-4 right-4 z-10 bg-[color-mix(in_oklab,var(--aura-surface-dim)_60%,transparent)] backdrop-blur-md p-2 rounded-full border border-white/10">
        <MapPin className="text-[var(--aura-chrome-bright)]" size={18} aria-hidden="true" />
      </div>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────────────── */

export function StitchOrderSuccessNew({
  order,
  isLoading = false,
  error = null,
  locale = 'vi',
  currency,
  onTrackOrder,
  onBack,
  onAccount,
  onRefresh,
}: Readonly<StitchOrderSuccessNewProps>) {
  const { t } = useTranslation();
  const isVietnamese = locale === 'vi' || locale.startsWith('vi');
  const effectiveCurrency = currency ?? (isVietnamese ? 'VND' : 'USD');
  const fmt = (amount: number) =>
    formatPrice(amount, locale, effectiveCurrency);

  /* ── DOMContentLoaded interactivity (matching HTML footer script) ───── */
  useEffect(() => {
    // Subtle interactivity: flash the status badge every ~5s with 5% chance
    const interval = setInterval(() => {
      if (Math.random() > 0.95) {
        const status = document.querySelector(
          '.text-\\[10px\\].font-bold.uppercase.tracking-widest.text-\\[var\\(--aura-chrome-bright\\)\\]',
        );
        if (status) {
          (status as HTMLElement).style.opacity = '0';
          setTimeout(() => {
            (status as HTMLElement).style.opacity = '1';
          }, 300);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  /* ── Loading ────────────────────────────────────────────────────────── */
  if (isLoading) {
    return <OrderSuccessNewSkeleton />;
  }

  /* ── Error ──────────────────────────────────────────────────────────── */
  if (error) {
    return <ErrorState message={error} onRetry={onRefresh} />;
  }

  /* ── Empty ──────────────────────────────────────────────────────────── */
  if (!order) {
    return <EmptyState />;
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[var(--aura-surface-dim)] flex flex-col items-center font-body antialiased">
      {/* Animation keyframes */}
      <style>{shineKeyframes}</style>

      {/* WebGL shader background nebula (matching HTML ANIMATION_63) */}
      <ShaderBackground />

      {/* ═══════════ HEADER ════════════════════════════════════════════ */}
      <header className="fixed top-0 w-full z-50 bg-[color-mix(in_oklab,var(--aura-surface-dim)_80%,transparent)] backdrop-blur-xl border-b border-white/10 flex justify-between items-center px-5 h-16">
        <button
          onClick={onBack}
          className="text-[var(--aura-chrome-bright)] hover:opacity-80 transition-opacity active:scale-95 transition-transform duration-200"
          aria-label={t('stitch.orderSuccessNewBack')}
        >
          <ArrowLeft aria-hidden="true" />
        </button>

        <h1
          className="text-2xl tracking-tight text-[var(--aura-chrome-bright)]"
          style={{ fontFamily: "'EB Garamond', serif" }}
        >
          AURA CAFE
        </h1>

        <button
          onClick={onAccount}
          className="text-[var(--aura-chrome-bright)] hover:opacity-80 transition-opacity active:scale-95 transition-transform duration-200"
          aria-label={t('stitch.orderSuccessNewAccount')}
        >
          <UserCircle aria-hidden="true" />
        </button>
      </header>

      {/* ═══════════ MAIN CONTENT ═════════════════════════════════════ */}
      <main className="w-full max-w-md px-5 pt-24 pb-8 flex flex-col gap-8 items-center">
        {/* Wait time display */}
        <WaitTimeDisplay estimatedMinutes={order.estimatedMinutes} />

        {/* Order summary glass card */}
        <OrderSummaryCard
          orderId={order.orderId}
          items={order.items}
          total={order.total}
          formatFn={fmt}
        />

        {/* Track Order CTA */}
        <ChromeButton
          onClick={onTrackOrder}
          label={t('stitch.orderSuccessNewTrackOrder', {
            defaultValue: 'TRACK ORDER',
          })}
          ariaLabel={t('stitch.orderSuccessNewTrackOrder', {
            defaultValue: 'TRACK ORDER',
          })}
        />

        {/* Location card */}
        <LocationCard
          locationName={order.locationName}
          imageUrl={order.locationImageUrl}
        />
      </main>

      {/* ═══════════ FOOTER ════════════════════════════════════════════ */}
      <footer className="w-full py-8 border-t border-white/5 flex flex-col items-center gap-2 px-5 bg-transparent">
        <nav className="flex gap-4 mb-2" aria-label={t('footer.footerAriaLabel')}>
          <a
            href="#"
            className="text-[12px] leading-none font-bold uppercase tracking-[0.1em] text-[var(--aura-chrome-soft)] hover:text-[var(--aura-chrome-bright)] transition-colors"
          >
            {t('stitch.orderSuccessNewSupport', {
              defaultValue: 'SUPPORT',
            })}
          </a>
          <a
            href="#"
            className="text-[12px] leading-none font-bold uppercase tracking-[0.1em] text-[var(--aura-chrome-soft)] hover:text-[var(--aura-chrome-bright)] transition-colors"
          >
            {t('footer.footerPrivacy', {
              defaultValue: 'PRIVACY POLICY',
            })}
          </a>
          <a
            href="#"
            className="text-[12px] leading-none font-bold uppercase tracking-[0.1em] text-[var(--aura-chrome-soft)] hover:text-[var(--aura-chrome-bright)] transition-colors"
          >
            {t('footer.footerTerms', { defaultValue: 'TERMS' })}
          </a>
        </nav>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--aura-chrome-soft)] opacity-40">
          {t('footer.copyright', {
            defaultValue:
              '© {{year}} AURA CAFE. ALL RIGHTS RESERVED.',
            year: 2024,
          })}
        </p>
      </footer>
    </div>
  );
}
