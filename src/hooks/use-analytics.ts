import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/* ═══════════════════════════════════════════════════════════════════
   Analytics 2.0 — Google Analytics 4 + Facebook Pixel
   Graceful no-ops when env vars are not configured.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Types ─── */

export interface AnalyticsItem {
  item_id?: string;
  item_name: string;
  price: number;
  quantity?: number;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

/* ─── Configuration ─── */

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
const FB_PIXEL_ID = import.meta.env.VITE_FB_PIXEL_ID as string | undefined;

const isGaEnabled = Boolean(GA_MEASUREMENT_ID);
const isFbEnabled = Boolean(FB_PIXEL_ID);

/* ─── Script injection ─── */

function injectGaScript(id: string): void {
  if (document.getElementById('ga-gtag')) return;

  const script = document.createElement('script');
  script.id = 'ga-gtag';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  const inline = document.createElement('script');
  inline.id = 'ga-gtag-init';
  inline.textContent = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${id}');
  `;
  document.head.appendChild(inline);
}

function injectFbScript(id: string): void {
  if (document.getElementById('fb-pixel')) return;

  const script = document.createElement('script');
  script.id = 'fb-pixel';
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  const inline = document.createElement('script');
  inline.id = 'fb-pixel-init';
  inline.textContent = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${id}');
    fbq('track', 'PageView');
  `;
  document.head.appendChild(inline);
}

/* ─── Public API ─── */

export function trackPageView(url: string): void {
  if (isGaEnabled && typeof window.gtag === 'function') {
    window.gtag('config', GA_MEASUREMENT_ID, { page_path: url });
  }
  if (isFbEnabled && typeof window.fbq === 'function') {
    window.fbq('track', 'PageView');
  }
}

export function trackEvent(action: string, params?: Record<string, unknown>): void {
  if (isGaEnabled && typeof window.gtag === 'function') {
    window.gtag('event', action, params);
  }
  if (isFbEnabled && typeof window.fbq === 'function') {
    window.fbq('track', action, params);
  }
}

export function trackPurchase(orderId: string, total: number, items: AnalyticsItem[]): void {
  if (isGaEnabled && typeof window.gtag === 'function') {
    window.gtag('event', 'purchase', {
      transaction_id: orderId,
      value: total,
      currency: 'VND',
      items,
    });
  }
  if (isFbEnabled && typeof window.fbq === 'function') {
    window.fbq('track', 'Purchase', { value: total, currency: 'VND' });
  }
}

/* ─── Initialization hook ─── */

export function useAnalytics(): void {
  const location = useLocation();

  useEffect(() => {
    if (isGaEnabled && GA_MEASUREMENT_ID) {
      injectGaScript(GA_MEASUREMENT_ID);
    }
    if (isFbEnabled && FB_PIXEL_ID) {
      injectFbScript(FB_PIXEL_ID);
    }
  }, []);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
}
