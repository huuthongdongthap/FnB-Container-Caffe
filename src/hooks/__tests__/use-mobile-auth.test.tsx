import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileAuthProvider, useMobileAuth } from '../use-mobile-auth';
import { useAuthStore } from '../stores/use-auth-store';
import { readClientSession, saveClientSession, invalidateClientSession } from '@/lib/client-session';
import { apiFetch, ApiClientError } from '@/lib/api-client';

const staff = { id: 'staff', name: 'Staff', email: '', role: 'staff', tenantId: 'cafe-a' };
const token = (suffix = 1, web = false, ttl = 1000) => `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttl, sessionType: web ? 'staff-web' : 'staff-mobile', suffix }))}.fixture`;
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const wrapper = ({ children }: { children: React.ReactNode }) => <MobileAuthProvider>{children}</MobileAuthProvider>;
beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ user: null, sessionVersion: 0, loading: false, error: null });
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('mobile session lifecycle', () => {
  it.each(['logout', 'other-tab'])('cannot restore a pending PIN login after %s', async mode => {
    let complete!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const { result } = renderHook(useMobileAuth, { wrapper });
    let login!: Promise<boolean>;
    act(() => { login = result.current.login('device', '1234'); });
    act(() => {
      if (mode === 'logout') invalidateClientSession();
      else window.dispatchEvent(new StorageEvent('storage', { key: 'aura_auth_token', newValue: null }));
    });
    await act(async () => { complete(reply({ token: token(), user: staff })); await login; });
    expect(result.current.isAuthenticated).toBe(false);
    expect(readClientSession().token).toBeNull();
  });
  it('both startup and manual refresh send Bearer and update web/mobile auth together', async () => {
    const original = token(); const next = token(2);
    saveClientSession(original, staff, 'enrolled-device');
    vi.mocked(fetch).mockResolvedValueOnce(reply({ token: next, user: staff })).mockResolvedValueOnce(reply({ token: next, user: staff }));
    const { result } = renderHook(useMobileAuth, { wrapper });
    await waitFor(() => expect(result.current.token).toBe(next));
    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringContaining('/mobile/refresh'), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: `Bearer ${original}` }), body: JSON.stringify({ device_token: 'enrolled-device' }),
    }));
    await act(async () => { expect(await result.current.refresh()).toBe(true); });
    expect(fetch).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${next}` }) }));
    expect(useAuthStore.getState().user).toMatchObject(staff);
    expect(localStorage.getItem('mobile_token')).toBe(next);
    expect(localStorage.getItem('aura_auth_token')).toBe(next);
  });
  it.each([[401, 'SESSION_EXPIRED'], [403, 'STAFF_ACCOUNT_INACTIVE'], [403, 'DEVICE_REVOKED']])('clears every session on %s/%s but retains device enrollment', async (status, code) => {
    saveClientSession(token(), staff, 'enrolled-device');
    vi.mocked(fetch).mockResolvedValue(reply({ error: 'Session rejected', code }, Number(status)));
    const { result } = renderHook(useMobileAuth, { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(result.current.deviceToken).toBe('enrolled-device');
    expect(localStorage.getItem('mobile_token')).toBeNull();
    expect(localStorage.getItem('aura_auth_token')).toBeNull();
    expect(localStorage.getItem('aura_auth_user')).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
  it.each([403, 503])('keeps the session on ordinary permission/outage status %s', async status => {
    const original = token(); saveClientSession(original, staff, 'enrolled-device');
    vi.mocked(fetch).mockResolvedValue(reply({ error: 'Try again', code: status === 503 ? 'AUTH_STATE_UNAVAILABLE' : 'FORBIDDEN' }, status));
    const { result } = renderHook(useMobileAuth, { wrapper });
    await waitFor(() => expect(result.current.error).toBe('Try again'));
    expect(result.current.isAuthenticated).toBe(true);
    expect(readClientSession().token).toBe(original);
  });
  it('does not let an older refresh restore a session after another login', async () => {
    const original = token(); saveClientSession(original, staff, 'enrolled-device');
    let complete!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const { result } = renderHook(useMobileAuth, { wrapper });
    const newer = token(3); const other = { ...staff, id: 'other', tenantId: 'cafe-b' };
    act(() => saveClientSession(newer, other, 'other-device'));
    await act(async () => { complete(reply({ token: token(2), user: staff })); });
    expect(result.current.token).toBe(newer);
    expect(result.current.user?.id).toBe('other');
  });
  it('logout revokes the current token and retains enrollment; forget removes enrollment', async () => {
    const original = token(1, true); saveClientSession(original, staff, 'enrolled-device');
    vi.mocked(fetch).mockResolvedValue(reply({ success: true }));
    const { result } = renderHook(useMobileAuth, { wrapper });
    act(() => result.current.logout());
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/auth/logout'), expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ Authorization: `Bearer ${original}` }),
    }));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.deviceToken).toBe('enrolled-device');
    act(() => result.current.forgetDevice());
    expect(result.current.deviceToken).toBeNull();
  });
  it('clears local authority at expiration while preserving the device', async () => {
    vi.useFakeTimers();
    saveClientSession(token(1, true, 1), staff, 'enrolled-device');
    const { result } = renderHook(useMobileAuth, { wrapper });
    await act(async () => { await vi.advanceTimersByTimeAsync(1001); });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.deviceToken).toBe('enrolled-device');
  });
  it('propagates structured API codes, without logout for an ordinary 403 or stale token response', async () => {
    const original = token(); saveClientSession(original, staff);
    vi.mocked(fetch).mockResolvedValueOnce(reply({ error: 'Not allowed', code: 'FORBIDDEN' }, 403));
    await expect(apiFetch('/api/private')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(readClientSession().token).toBe(original);
    vi.mocked(fetch).mockResolvedValueOnce(reply({ error: 'Inactive', code: 'STAFF_ACCOUNT_INACTIVE' }, 403));
    await expect(apiFetch('/api/private')).rejects.toBeInstanceOf(ApiClientError);
    expect(readClientSession().token).toBeNull();
    saveClientSession(token(3), staff);
    vi.mocked(fetch).mockResolvedValueOnce(reply({ error: 'Old request', code: 'SESSION_REVOKED' }, 401));
    await expect(apiFetch('/api/private', { headers: { Authorization: `Bearer ${original}` } })).rejects.toMatchObject({ status: 401 });
    expect(readClientSession().token).toBe(token(3));
  });
});
