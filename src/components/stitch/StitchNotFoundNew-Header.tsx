import { MenuIcon } from './StitchNotFoundNew-MenuIcon';

interface HeaderProps {
  onNavigate?: (path: string) => void;
}

export function Header({ onNavigate }: HeaderProps) {
  return (
    <header className="fixed top-0 w-full backdrop-blur-md bg-[var(--aura-surface-dim)]/40 flex items-center justify-between px-5 h-20 z-40">
      <button
        onClick={() => onNavigate?.('/menu')}
        className="text-[var(--aura-chrome-bright)] cursor-pointer hover:opacity-80 transition-opacity"
        aria-label="Menu"
      >
        <MenuIcon />
      </button>
      <div className="absolute left-1/2 -translate-x-1/2">
        <h1 className="font-['EB_Garamond'] text-[40px] leading-none tracking-tighter text-[var(--aura-chrome-bright)]">
          AURA CAFE
        </h1>
      </div>
      <div className="w-8" />
    </header>
  );
}
