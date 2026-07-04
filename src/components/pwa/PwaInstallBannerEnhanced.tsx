import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Download, Smartphone, RefreshCw } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_STORAGE_KEY = 'aura-pwa-install-dismissed';
const APP_ICON = '/images/favicon-192x192.png';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [animateIn, setAnimateIn] = useState(false);

  const isIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
  }, []);

  const isStandalone = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  }, []);

  useEffect(() => {
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, [isStandalone]);

  useEffect(() => {
    if (!dismissed && !isInstalled) {
      const t = setTimeout(() => setAnimateIn(true), 300);
      return () => clearTimeout(t);
    }
  }, [dismissed, isInstalled]);

  const shouldShow =
    !isInstalled &&
    !dismissed &&
    (isIOS || !!deferredPrompt);

  const handleInstall = useCallback(async () => {
    if (isIOS) {
      try {
        localStorage.setItem(DISMISS_STORAGE_KEY, 'true');
      } catch {
        /* noop */
      }
      setDismissed(true);
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
  }, [isIOS, deferredPrompt]);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, 'true');
    } catch {
      /* noop */
    }
    setDismissed(true);
  }, []);

  if (!shouldShow) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 sm:max-w-[60%]"
      role="dialog"
      aria-label="Install app prompt"
      style={{
        animation: animateIn ? 'fnb-slide-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) both' : 'none',
        opacity: animateIn ? 1 : 0,
      }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-2xl backdrop-blur-[calc(var(--glass-blur))]">
        {/* Chrome accent top line */}
        <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--aura-chrome-light)] to-transparent opacity-40" />

        <div className="p-4">
          <div className="flex items-start gap-3.5">
            {/* App icon */}
            <img
              src={APP_ICON}
              alt="AURA CAFE"
              className="mt-0.5 h-12 w-12 shrink-0 rounded-xl border border-[var(--aura-glass-border)] object-cover shadow-lg"
              width={48}
              height={48}
            />

            {/* Text content */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--aura-chrome-bright)]">
                Cài Đặt AURA CAFE
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--aura-text-secondary)]">
                {isIOS
                  ? 'Chia sẻ (Share) -> Thêm vào Màn Hình Chính để truy cập nhanh'
                  : 'Cài đặt ứng dụng để đặt hàng nhanh hơn và nhận ưu đãi độc quyền'}
              </p>

              {/* Benefit pills */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--aura-glass-border)] bg-[var(--aura-bg-glass)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-[var(--aura-chrome-dark)]">
                  <Download className="h-3 w-3" />
                  Dùng Offline
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--aura-glass-border)] bg-[var(--aura-bg-glass)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-[var(--aura-chrome-dark)]">
                  <Smartphone className="h-3 w-3" />
                  Đặt 1 Chạm
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--aura-glass-border)] bg-[var(--aura-bg-glass)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-[var(--aura-chrome-dark)]">
                  <RefreshCw className="h-3 w-3" />
                  Luôn Mới Nhất
                </span>
              </div>

              {/* Actions */}
              <div className="mt-3.5 flex items-center gap-2.5">
                <button
                  onClick={handleInstall}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--aura-chrome-light)] to-[var(--aura-chrome-bright)] px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0A1A2E] shadow-lg shadow-[var(--aura-chrome-dark)]/20 transition-all duration-300 hover:scale-[1.03] hover:shadow-[var(--aura-glow-chrome-strong)] active:scale-95"
                  type="button"
                >
                  <Download className="h-3.5 w-3.5" />
                  {isIOS ? 'Hướng Dẫn' : 'Cài Đặt Ngay'}
                </button>
                <button
                  onClick={handleDismiss}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--aura-glass-border)] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--aura-text-secondary)] transition-all duration-200 hover:border-[var(--aura-chrome-dark)] hover:bg-[var(--aura-bg-glass-hover)] hover:text-[var(--aura-chrome-light)] active:scale-95"
                  type="button"
                >
                  Để Sau
                </button>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="shrink-0 -mr-1 -mt-1 rounded-full p-1.5 text-[var(--aura-text-secondary)] transition-colors duration-200 hover:bg-[var(--aura-bg-glass-hover)] hover:text-[var(--aura-chrome-bright)]"
              aria-label="Đóng"
              type="button"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
