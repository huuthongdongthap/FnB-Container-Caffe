import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecruitmentPage from '../RecruitmentPage';
import { apiFetch } from '@/lib/api-client';
import { invalidateClientSession, saveClientSession } from '@/lib/client-session';
vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));
vi.mock('@/components/stitch/StitchLandingNew-nav', () => ({ LandingNav: () => null }));
vi.mock('@/components/stitch/StitchLandingNew-footer', () => ({ LandingFooter: () => null }));
vi.mock('@/components/seo/HelmetHead', () => ({ HelmetHead: () => null }));
const deferred = () => { let resolve!: (body: unknown) => void; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; };
const fill = (name = 'Candidate A') => {
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn An'), { target: { value: name } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912 345 678'), { target: { value: '0901234567' } });
};
const submit = () => fireEvent.submit(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn An').closest('form')!);
beforeEach(() => { vi.clearAllMocks(); invalidateClientSession(); });
describe('public recruitment server confirmation', () => {
  it('keeps the form on 503, retries using the same key and never writes a PII draft or contact fallback', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('503 unavailable'))
      .mockResolvedValueOnce({ success: true, id: 'persisted-1' });
    render(<RecruitmentPage />); fill();
    const writes = vi.mocked(localStorage.setItem).mock.calls.length;
    submit();
    expect(await screen.findByText(/Chưa xác nhận đã gửi hồ sơ/)).toBeTruthy();
    expect(screen.getByDisplayValue('Candidate A')).toBeTruthy();
    expect(screen.queryByText('Đã Tiếp Nhận Hồ Sơ Thành Công!')).toBeNull();
    submit();
    expect(await screen.findByText('Đã Tiếp Nhận Hồ Sơ Thành Công!')).toBeTruthy();
    const calls = vi.mocked(apiFetch).mock.calls;
    expect(calls.map(call => call[0])).toEqual(['/api/recruitment/apply', '/api/recruitment/apply']);
    expect(calls[0]?.[1]?.headers).toEqual(calls[1]?.[1]?.headers);
    expect(vi.mocked(localStorage.setItem).mock.calls.length).toBe(writes);
  });
  it('rejects a success response without a persisted ID and changes keys when the payload changes', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true });
    render(<RecruitmentPage />); fill(); submit();
    await screen.findByText(/Chưa xác nhận đã gửi hồ sơ/);
    fill('Candidate Changed'); submit();
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    const calls = vi.mocked(apiFetch).mock.calls;
    expect(calls[0]?.[1]?.headers).not.toEqual(calls[1]?.[1]?.headers);
    expect(screen.queryByText('Đã Tiếp Nhận Hồ Sơ Thành Công!')).toBeNull();
  });
  it('blocks a repeated submit while a request is pending', async () => {
    const pending = deferred(); vi.mocked(apiFetch).mockReturnValue(pending.promise);
    render(<RecruitmentPage />); fill(); submit(); submit();
    expect(apiFetch).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ success: true, id: 'persisted-1' }));
  });
  it('unmounts A’s PII on session changes and A’s late finally cannot complete B’s form', async () => {
    const a = deferred(); const b = deferred();
    vi.mocked(apiFetch).mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    render(<RecruitmentPage />); fill(); submit();
    act(() => saveClientSession('manager-b', { id: 'b', name: 'B', role: 'manager' }));
    expect(screen.queryByDisplayValue('Candidate A')).toBeNull();
    fill('Candidate B'); submit();
    await act(async () => a.resolve({ success: true, id: 'from-a' }));
    expect(screen.getByText('Đang gửi hồ sơ...').closest('button')).toBeDisabled();
    expect(screen.getByDisplayValue('Candidate B')).toBeTruthy();
    expect(screen.queryByText('Đã Tiếp Nhận Hồ Sơ Thành Công!')).toBeNull();
    const calls = vi.mocked(apiFetch).mock.calls;
    expect(calls[0]?.[1]?.headers).not.toEqual(calls[1]?.[1]?.headers);
    await act(async () => b.resolve({ success: true, id: 'from-b' }));
    expect(screen.getByText('Đã Tiếp Nhận Hồ Sơ Thành Công!')).toBeTruthy();
  });
});
