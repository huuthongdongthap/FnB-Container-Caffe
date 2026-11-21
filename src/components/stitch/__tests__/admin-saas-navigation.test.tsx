import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore, type AuthUser } from '@/hooks/stores/use-auth-store';
import { Sidebar } from '../StitchAdminTerminalNew-sidebar';
import { isHqSuperAdminActor } from '../admin-nav-visibility';
import { isHQSuperAdmin } from '../../../../worker/src/middleware/tenant';

vi.mock('react-i18next', () => ({ useTranslation: () => ({
  t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
}) }));

afterEach(() => act(() => useAuthStore.setState({ user: null })));

function renderSidebar(role: AuthUser['role'], tenantId?: string, route = '/admin') {
  useAuthStore.setState({ user: { id: 'actor', name: 'Admin', email: 'test@example.test', role, tenantId } });
  return render(<MemoryRouter initialEntries={[route]}>
    <Sidebar open onClose={() => {}} brandName="Shop" brandSubtitle="Admin"
      adminName="Admin" terminalId="Terminal" adminAvatarUrl="" />
  </MemoryRouter>);
}

describe('SaaS sidebar discoverability', () => {
  it.each(['owner', 'admin', 'manager'] as const)('shows tenant settings but not HQ to tenant %s', (role) => {
    renderSidebar(role, 'tenant-a');
    expect(screen.getByRole('link', { name: 'Cài đặt cửa hàng & SaaS' })).toHaveAttribute('href', '/admin/saas-settings');
    expect(screen.queryByRole('link', { name: 'HQ Quản trị SaaS' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gói hội viên tại quán' })).toHaveAttribute('href', '/admin/subscriptions');
  });

  it.each([['owner', 'hq'], ['admin', '*']] as const)('shows HQ only to explicitly scoped %s/%s', (role, scope) => {
    renderSidebar(role, scope, '/admin/hq/tenants');
    expect(screen.getByRole('link', { name: 'HQ Quản trị SaaS' })).toHaveAttribute('aria-current', 'page');
  });

  it.each(['staff', 'supervisor', 'cashier', 'waiter', 'shipper', 'kitchen', 'barista', 'chef', 'customer'] as const)(
    'hides privileged entries from broad shell role %s even with hq tenant', (role) => {
      renderSidebar(role, 'hq');
      expect(screen.queryByRole('link', { name: 'Cài đặt cửa hàng & SaaS' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'HQ Quản trị SaaS' })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Đơn hàng' })).toBeInTheDocument();
    },
  );

  it.each([undefined, 'default', 'tenant-a'])('does not infer HQ scope for owner tenant %s', (scope) => {
    renderSidebar('owner', scope);
    expect(screen.queryByRole('link', { name: 'HQ Quản trị SaaS' })).not.toBeInTheDocument();
  });

  it('reacts to authenticated actor changes', () => {
    renderSidebar('owner', 'hq');
    expect(screen.getByRole('link', { name: 'HQ Quản trị SaaS' })).toBeInTheDocument();
    act(() => useAuthStore.setState({ user: { id: 'b', name: 'B', email: 'b@example.test', role: 'admin', tenantId: 'tenant-b' } }));
    expect(screen.queryByRole('link', { name: 'HQ Quản trị SaaS' })).not.toBeInTheDocument();
  });

  it('matches the backend HQ predicate including legacy snake-case and missing scope', () => {
    for (const actor of [null, {}, { role: 'owner' }, { role: 'manager', tenantId: 'hq' },
      { role: 'admin', tenantId: '*' }, { role: ' OWNER ', tenant_id: ' HQ ' },
      { role: 'owner', tenantId: 'tenant-a', tenant_id: 'hq' }, { role: 'admin', tenantId: '', tenant_id: '*' }]) {
      expect(isHqSuperAdminActor(actor)).toBe(isHQSuperAdmin(actor));
    }
  });
});
