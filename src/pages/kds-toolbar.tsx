import { Bell, BellOff, Maximize2, Minimize2 } from 'lucide-react';

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
  return (
    <div className="fixed top-3 right-4 z-[100] flex items-center gap-1">
      <button
        onClick={onToggleSound}
        type="button"
        className="rounded p-1.5 text-[var(--aura-text-primary,#e8e8e8)] transition-colors hover:bg-white/5"
        title={soundEnabled ? 'Mute alerts' : 'Enable alerts'}
      >
        {soundEnabled ? <Bell size={16} /> : <BellOff size={16} />}
      </button>
      <button
        onClick={onToggleFullscreen}
        type="button"
        className="rounded p-1.5 text-[var(--aura-text-primary,#e8e8e8)] transition-colors hover:bg-white/5"
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
    </div>
  );
}
