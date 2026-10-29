import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminRecruitmentStore } from '../use-admin-recruitment-store';
import { apiFetch } from '@/lib/api-client';
import { invalidateClientSession, saveClientSession } from '@/lib/client-session';
vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));
const candidate = { fullName: 'Private A', phone: '0901234567', position: 'barista' as const, shifts: ['ca1'], experience: 'none' };
const app = { ...candidate, id: 'server-1', status: 'pending' as const, createdAt: '2026-10-23', updatedAt: '2026-10-23' };
const deferred = () => { let resolve!: (value: unknown) => void; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; };
beforeEach(() => {
  vi.clearAllMocks(); invalidateClientSession();
  saveClientSession('owner-a', { id: 'a', name: 'A', role: 'owner' });
});
describe('server-confirmed recruitment', () => {
  it('exposes unavailable instead of loading browser-only PII', async () => {
    localStorage.setItem('aura_recruitment_applications', JSON.stringify([app]));
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('503 unavailable'));
    await useAdminRecruitmentStore.getState().fetchApplications();
    expect(useAdminRecruitmentStore.getState().error).toContain('503');
    expect(useAdminRecruitmentStore.getState().applications).toEqual([]);
    vi.mocked(apiFetch).mockResolvedValueOnce({ success: true, data: [] });
    await useAdminRecruitmentStore.getState().fetchApplications();
    expect(useAdminRecruitmentStore.getState().error).toBeNull();
    expect(useAdminRecruitmentStore.getState().applications).toEqual([]);
  });
  it.each(['update', 'delete', 'add'])('preserves state and browser storage on failed %s', async operation => {
    useAdminRecruitmentStore.setState({ applications: [app] });
    const writes = vi.mocked(localStorage.setItem).mock.calls.length;
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('503'));
    const store = useAdminRecruitmentStore.getState();
    const ok = operation === 'update' ? await store.updateStatus(app.id, 'hired') : operation === 'delete'
      ? await store.deleteApplication(app.id) : await store.addCandidate(candidate);
    expect(ok).toBe(false); expect(useAdminRecruitmentStore.getState().applications).toEqual([app]);
    expect(vi.mocked(localStorage.setItem).mock.calls.length).toBe(writes);
  });
  it('uses protected creation, stable retry keys, changed payload keys and persisted IDs', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('Lost response'));
    await useAdminRecruitmentStore.getState().addCandidate(candidate);
    await useAdminRecruitmentStore.getState().addCandidate(candidate);
    await useAdminRecruitmentStore.getState().addCandidate({ ...candidate, fullName: 'Changed' });
    const calls = vi.mocked(apiFetch).mock.calls;
    expect(calls[0]?.[0]).toBe('/api/recruitment/applications');
    const key = (index: number) => (calls[index]?.[1]?.headers as Record<string, string>)['Idempotency-Key'];
    expect(key(0)).toBeTruthy(); expect(key(1)).toBe(key(0)); expect(key(2)).not.toBe(key(0));
    vi.mocked(apiFetch).mockResolvedValueOnce({ success: true, id: app.id, data: app });
    expect(await useAdminRecruitmentStore.getState().addCandidate(candidate)).toBe(true);
    expect(useAdminRecruitmentStore.getState().applications).toEqual([app]);
  });
  it('blocks duplicate entity writes and ignores older GETs', async () => {
    useAdminRecruitmentStore.setState({ applications: [app] });
    const read = deferred(); const write = deferred();
    vi.mocked(apiFetch).mockReturnValueOnce(read.promise).mockReturnValueOnce(write.promise);
    const oldRead = useAdminRecruitmentStore.getState().fetchApplications();
    const update = useAdminRecruitmentStore.getState().updateStatus(app.id, 'hired');
    expect(await useAdminRecruitmentStore.getState().deleteApplication(app.id)).toBe(false);
    write.resolve({ success: true }); await update;
    read.resolve({ success: true, data: [app] }); await oldRead;
    expect(useAdminRecruitmentStore.getState().applications[0]?.status).toBe('hired');
  });
  it('rejects missing ID and returns false on A’s late success', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ success: true });
    expect(await useAdminRecruitmentStore.getState().addCandidate(candidate)).toBe(false);
    const write = deferred(); vi.mocked(apiFetch).mockReturnValueOnce(write.promise);
    const old = useAdminRecruitmentStore.getState().addCandidate(candidate);
    saveClientSession('manager-b', { id: 'b', name: 'B', role: 'manager' });
    write.resolve({ success: true, data: app });
    expect(await old).toBe(false); expect(useAdminRecruitmentStore.getState().applications).toEqual([]);
  });
  it.each(['staff', 'admin', 'cashier', 'waiter', 'kitchen'])('rejects all recruitment actions for %s without exposing cached PII', async role => {
    saveClientSession('restricted', { id: 'r', name: 'R', role });
    const store = useAdminRecruitmentStore.getState();
    await store.fetchApplications(); await store.addCandidate(candidate); await store.updateStatus(app.id, 'hired'); await store.deleteApplication(app.id);
    expect(apiFetch).not.toHaveBeenCalled(); expect(useAdminRecruitmentStore.getState().applications).toEqual([]);
  });
});
