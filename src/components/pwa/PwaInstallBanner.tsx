import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstall } from '@/hooks/use-pwa-install';
import { useTranslation } from 'react-i18next';

export function PwaInstallBanner() {
  const { t } = useTranslation();
  const { showPrompt, install, dismiss, isInstalled } = usePwaInstall();

  if (isInstalled) return null;
  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border border-chrome-light/10 bg-gradient-to-br from-[#0A1A2E] to-[#050D1A] p-4 shadow-2xl backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="mt-1">
          <Download className="h-5 w-5 text-chrome-bright" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-chrome-bright">{t('pwa.installTitle')}</p>
          <p className="mt-0.5 text-xs text-chrome-light/60">
            {t('pwa.installDesc')}
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={install}>
              <Download className="h-3 w-3 mr-1" /> {t('pwa.install')}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {t('pwa.later')}
            </Button>
          </div>
        </div>
        <button onClick={dismiss} className="text-chrome-light/40 hover:text-chrome-light/80">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
