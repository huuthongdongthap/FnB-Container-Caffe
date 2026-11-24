import { Bell, BellOff, Maximize2, Minimize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface KdsToolbarProps {
  soundEnabled: boolean;
  isFullscreen: boolean;
  onToggleSound: () => void;
  onToggleFullscreen: () => void;
}

export function KdsToolbar({
  soundEnabled,
  isFullscreen,
  onToggleSound,
  onToggleFullscreen,
}: KdsToolbarProps) {
  const { t } = useTranslation();
  const soundLabel = soundEnabled
    ? t('kds.muteAlerts', 'Mute alerts')
    : t('kds.enableAlerts', 'Enable alerts');
  const fullscreenLabel = isFullscreen
    ? t('kds.exitFullscreen', 'Exit fullscreen')
    : t('kds.fullscreen', 'Fullscreen');
  return (
    <div className="fixed top-3 right-4 z-[100] flex items-center gap-1">
      <button
        onClick={onToggleSound}
        type="button"
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded p-1.5 text-[var(--aura-text-primary,#e8e8e8)] transition-colors hover:bg-white/5"
        title={soundLabel}
        aria-label={soundLabel}
      >
        {soundEnabled ? <Bell size={16} /> : <BellOff size={16} />}
      </button>
      <button
        onClick={onToggleFullscreen}
        type="button"
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded p-1.5 text-[var(--aura-text-primary,#e8e8e8)] transition-colors hover:bg-white/5"
        title={fullscreenLabel}
        aria-label={fullscreenLabel}
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
    </div>
  );
}
