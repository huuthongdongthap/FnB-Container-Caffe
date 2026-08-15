import { User } from 'lucide-react';

export function TopAppBar() {
  return (
    <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[var(--aura-surface-container)] bg-[var(--aura-surface-dim)] px-5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="text-[var(--aura-chrome-bright)] active:scale-95"
          aria-label="Menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt="AURA CAFE Logo"
          className="h-8 w-8 object-contain"
          src="https://lh3.googleusercontent.com/aida/AP1WRLst_bTmebzLq1BIwYvixuANOxS8OzfdrBiG2ek-VB__5o2iYZd2ZMsg4kX1zZBn7lg4OrV1tetohSyD_Vta-8z-tGVmew1Saua_uy54G0H1UEcqGN_63Rb7e7JbTVRWbOL7k8Y890nV1SxSyXOEGhOu1MOdNh4DAc8LE9KsFaaSvL6aS2ne-NplbsnM_54D0oC9GTTlcojd87dGQYuvqZScZ16Ndyu7R5f-P7_RqlySuyC_fGxgjYJksk4"
        />
        <span className="font-[family-name:var(--aura-display-font)] text-2xl uppercase tracking-widest text-[var(--aura-chrome-bright)]">
          AURA CAFE
        </span>
      </div>
      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[var(--aura-surface-container)] bg-[var(--aura-surface-container)] active:scale-95">
        <User className="text-sm text-[var(--aura-bronze-shimmer)]" />
      </div>
    </header>
  );
}
