/**
 * StitchOrderMgmtNew Header Composer
 * Combines sidebar and top app bar with mobile overlay.
 */
import { StitchOrderMgmtSidebar } from './StitchOrderMgmtNew-sidebar';
import { StitchOrderMgmtTopBar } from './StitchOrderMgmtNew-topbar';

/* ─── Props ──────────────────────────────────────────────────────────── */

interface HeaderProps {
  brandName: string;
  brandSubtitle: string;
  headerTitle: string;
  headerSubtitle: string;
  adminName: string;
  adminAvatarUrl: string;
  activeNav: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

/* ─── Combined Header Export ─────────────────────────────────────────── */

export function StitchOrderMgmtHeader(props: Readonly<HeaderProps>) {
  const { sidebarOpen, onToggleSidebar, ...rest } = props;

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onToggleSidebar}
          aria-label="Close sidebar"
        />
      )}

      <StitchOrderMgmtSidebar
        brandName={rest.brandName}
        brandSubtitle={rest.brandSubtitle}
        activeNav={rest.activeNav}
        sidebarOpen={sidebarOpen}
        onClose={onToggleSidebar}
      />

      <StitchOrderMgmtTopBar
        headerTitle={rest.headerTitle}
        headerSubtitle={rest.headerSubtitle}
        adminName={rest.adminName}
        adminAvatarUrl={rest.adminAvatarUrl}
        onToggleSidebar={onToggleSidebar}
      />
    </>
  );
}
