/**
 * Load more button for StitchGalleryNew
 */

interface GalleryLoadMoreProps {
  onClick?: () => void;
}

export function GalleryLoadMore({ onClick }: GalleryLoadMoreProps) {
  return (
    <div className="mt-20 flex justify-center">
      <button
        type="button"
        onClick={onClick}
        className="border border-[var(--aura-chrome-soft)]/50 px-12 py-4 font-[family-name:var(--aura-body-font)] text-base tracking-widest text-[var(--aura-chrome-bright)] transition-all duration-300 hover:bg-[var(--aura-chrome-bright)] hover:text-[var(--aura-surface-dim)]"
      >
        LOAD MORE ARCHIVES
      </button>
    </div>
  );
}
