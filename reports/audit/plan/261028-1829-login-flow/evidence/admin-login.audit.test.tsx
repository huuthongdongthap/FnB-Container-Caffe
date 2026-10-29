import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import AdminLogin from '/Users/mac/mekong-cli/FnB-Container-Caffe/src/pages/admin/Login';
import { useAuthStore } from '/Users/mac/mekong-cli/FnB-Container-Caffe/src/hooks/stores/use-auth-store';
import { saveClientSession, invalidateClientSession } from '/Users/mac/mekong-cli/FnB-Container-Caffe/src/lib/client-session';
import { apiFetch } from '/Users/mac/mekong-cli/FnB-Container-Caffe/src/lib/api-client';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/lib/api-client', async (original) => ({ ...(await original<Record<string, unknown>>()), apiFetch: vi.fn() }));
vi.mock('@/components/stitch', () => ({ StitchAdminLoginNew: (props: {
  onLogin: (email: string, password: string) => Promise<void>; status: string;
}) => <div><button onClick={() => { void props.onLogin('another@audit.invalid', 'invalid-local-only'); }}>Attempt login</button>
  <output data-testid="login-status">{props.status}</output></div> }));

const observations: unknown[] = [];
beforeEach(() => {
  invalidateClientSession(); localStorage.clear(); navigate.mockClear();
  useAuthStore.setState({ user: null, loading: false, error: null });
  vi.mocked(apiFetch).mockReset();
});
afterEach(() => { cleanup(); invalidateClientSession(); });
afterAll(() => writeFileSync('/Users/mac/mekong-cli/FnB-Container-Caffe/reports/audit/plan/261028-1829-login-flow/evidence/admin-observations.json', JSON.stringify(observations, null, 2)));

describe('Audit security acceptance: Admin login result', () => {
  it('LOGIN-03: a failed new login must not report success from a previous user', async () => {
    saveClientSession('synthetic-previous-token', { id: 'previous-operator', role: 'owner', name: 'Synthetic operator', tenantId: 'default' });
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Synthetic invalid credentials'));
    render(<AdminLogin />);
    await act(async () => { fireEvent.click(screen.getByText('Attempt login')); });
    const uiStatus = screen.getByTestId('login-status').textContent;
    observations.push({ id: 'LOGIN-03', uiStatus, navigatedToAdmin: navigate.mock.calls.some(([path]) => path === '/admin'),
      previousUserRetained: useAuthStore.getState().user?.id === 'previous-operator',
      errorRecorded: Boolean(useAuthStore.getState().error), apiBehavior: 'Rejected invalid credentials',
      expected: 'Show error; do not navigate as a successful new login' });
    expect(uiStatus).toBe('error');
    expect(navigate).not.toHaveBeenCalled();
  });
});
