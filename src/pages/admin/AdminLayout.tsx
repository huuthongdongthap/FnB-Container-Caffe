import { Outlet } from 'react-router-dom';

import { StitchAdminTerminalNew } from '@/components/stitch';

export default function AdminLayout({ children }: { children?: React.ReactNode } = {}) {
  return (
    <StitchAdminTerminalNew>
      {children ?? <Outlet />}
    </StitchAdminTerminalNew>
  );
}
