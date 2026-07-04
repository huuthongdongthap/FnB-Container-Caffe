import { Outlet } from 'react-router-dom';

import { StitchAdminTerminalNew } from '@/components/stitch';

export default function AdminLayout() {
  return (
    <StitchAdminTerminalNew>
      <Outlet />
    </StitchAdminTerminalNew>
  );
}
