'use client';

import { useTranslation } from 'react-i18next';
import { Clock, Home, LayoutDashboard, ClipboardList, ChefHat, UserCheck, AlertTriangle } from 'lucide-react';
import type { POSActiveShift } from './StitchPOSNew-types';
import { LiveClock } from './StitchPOSNew-live-clock';

function formatShiftStartTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

export function POSHeader({
  brandName,
  staffName,
  staffRole,
  activeShift = null,
  onShiftAction,
  onOpenSchedule,
  onNavigate,
}: {
  brandName: string;
  staffName?: string;
  staffRole?: string;
  activeShift?: POSActiveShift | null;
  onShiftAction?: () => void;
  onOpenSchedule?: () => void;
  onNavigate?: (path: string) => void;
}) {
  const { t } = useTranslation();
  const displayStaffName = staffName?.trim() || t('posNew.staffDefault', { defaultValue: 'Nhân viên' });
  const shiftStart = formatShiftStartTime(activeShift?.clockIn);

  const handleNav = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else if (typeof window !== 'undefined') {
      window.location.assign(path);
    }
  };

  return (
    <header
      className="bg-[var(--aura-noir-void,#050814)]/95 backdrop-blur-md border-b border-[var(--aura-chrome-light,#B8C5D0)]/15 flex justify-between items-center px-4 lg:px-6 h-16 w-full fixed top-0 z-50 gap-3"
      role="banner"
    >
      {/* Brand + 1-tap Navigation (#116) */}
      <div className="flex items-center gap-2 lg:gap-3 min-w-0">
        <button
          type="button"
          onClick={() => handleNav('/admin')}
          className="text-[14px] text-[#f2c08d] uppercase tracking-widest font-semibold font-body hover:brightness-110 transition-all cursor-pointer shrink-0"
          aria-label={`${brandName} — Quản trị`}
        >
          {brandName}
        </button>
        <div className="h-5 w-px bg-[var(--aura-chrome-light,#B8C5D0)]/20 shrink-0" aria-hidden="true" />
        <nav className="flex items-center gap-1.5" aria-label={t('posNew.quickNav', { defaultValue: 'Điều hướng POS' })}>
          <button
            type="button"
            onClick={() => handleNav('/admin')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] text-[var(--aura-text-primary,#eae1db)] bg-[var(--aura-chrome-light,#B8C5D0)]/10 hover:bg-[var(--aura-chrome-light,#B8C5D0)]/20 border border-[var(--aura-chrome-light,#B8C5D0)]/15 transition-colors cursor-pointer shrink-0 font-body"
            aria-label={t('posNew.backToAdmin', { defaultValue: 'Quản trị' })}
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-[#f2c08d]" />
            <span className="hidden sm:inline">{t('posNew.backToAdmin', { defaultValue: 'Quản trị' })}</span>
          </button>
          <button
            type="button"
            onClick={() => handleNav('/admin/orders')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] text-[var(--aura-text-muted,#8a7a6a)] hover:text-[var(--aura-text-primary,#eae1db)] hover:bg-[var(--aura-chrome-light,#B8C5D0)]/10 transition-colors cursor-pointer shrink-0 font-body"
            aria-label={t('posNew.navOrders', { defaultValue: 'Đơn hàng' })}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t('posNew.navOrders', { defaultValue: 'Đơn hàng' })}</span>
          </button>
          <button
            type="button"
            onClick={() => handleNav('/kds')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] text-[var(--aura-text-muted,#8a7a6a)] hover:text-[var(--aura-text-primary,#eae1db)] hover:bg-[var(--aura-chrome-light,#B8C5D0)]/10 transition-colors cursor-pointer shrink-0 font-body"
            aria-label={t('posNew.navKds', { defaultValue: 'KDS' })}
          >
            <ChefHat className="w-3.5 h-3.5" />
            <span className="hidden md:inline">KDS</span>
          </button>
          <button
            type="button"
            onClick={() => handleNav('/')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] text-[var(--aura-text-muted,#8a7a6a)] hover:text-[var(--aura-text-primary,#eae1db)] hover:bg-[var(--aura-chrome-light,#B8C5D0)]/10 transition-colors cursor-pointer shrink-0 font-body"
            aria-label={t('posNew.navHome', { defaultValue: 'Trang chủ' })}
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{t('posNew.navHome', { defaultValue: 'Trang chủ' })}</span>
          </button>
        </nav>
      </div>

      {/* Shift Status Badge + Clock + Staff (#112) */}
      <div className="flex items-center gap-2.5 lg:gap-3 shrink-0">
        <button
          type="button"
          onClick={() => (onShiftAction ? onShiftAction() : onOpenSchedule?.())}
          data-testid="pos-shift-badge"
          className={
            activeShift
              ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors cursor-pointer font-body'
              : 'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-400/40 hover:bg-amber-500/30 transition-colors cursor-pointer font-body'
          }
          aria-label={
            activeShift
              ? `Ca đang mở${shiftStart ? ` từ ${shiftStart}` : ''} — Bấm để bàn giao ca`
              : 'Chưa mở ca — Bấm để mở ca'
          }
        >
          {activeShift ? (
            <>
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>
                {activeShift.shiftName || 'Ca làm việc'} &bull; Đang mở
                {shiftStart ? ` (từ ${shiftStart})` : ''}
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Chưa mở ca — Mở ca</span>
            </>
          )}
        </button>

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--aura-noir-deep,#0A1A2E)]/80 border border-[var(--aura-chrome-light,#B8C5D0)]/12">
          <Clock className="w-3.5 h-3.5 text-[var(--aura-text-muted,#8A8E96)]" aria-hidden="true" />
          <LiveClock />
        </div>

        <button
          type="button"
          onClick={() => onOpenSchedule?.()}
          className="flex items-center gap-2 bg-[var(--aura-noir-deep,#0A1A2E)]/70 px-3 py-1.5 rounded-lg border border-[var(--aura-chrome-light,#B8C5D0)]/15 hover:border-[var(--aura-chrome-light,#B8C5D0)]/35 cursor-pointer active:scale-95 transition-all"
          aria-label={`${t('posNew.userProfile')}: ${displayStaffName}`}
        >
          <UserCheck className="w-4 h-4 text-[#f2c08d] shrink-0" />
          <span className="text-[12px] font-body text-[var(--aura-text-primary,#eae1db)] max-w-[120px] truncate">
            {displayStaffName}
          </span>
          {staffRole && (
            <span className="hidden xl:inline text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--aura-chrome-light,#B8C5D0)]/12 text-[var(--aura-text-muted,#8A8E96)] font-body">
              {staffRole}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
