import type { ReactNode } from 'react';

export interface NavItemData {
  label: string;
  labelEn: string;
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export interface NavSectionData {
  title?: string;
  items: NavItemData[];
}

export interface StitchAdminTerminalNewProps {
  /** Brand title shown in sidebar */
  brandName?: string;
  /** Subtitle shown below brand */
  brandSubtitle?: string;
  /** Admin profile display name */
  adminName?: string;
  /** Admin terminal identifier */
  terminalId?: string;
  /** Admin avatar image URL */
  adminAvatarUrl?: string;
  /** Optional children to render in main area (falls back to <Outlet />) */
  children?: ReactNode;
}
