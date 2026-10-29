import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecruitmentTab } from '../staff-recruitment-tab';
import { useAdminRecruitmentStore } from '@/hooks/stores/admin/use-admin-recruitment-store';
import { saveClientSession, invalidateClientSession } from '@/lib/client-session';
vi.mock('@/hooks/stores/admin/use-admin-recruitment-store', () => ({ useAdminRecruitmentStore: vi.fn() }));
const candidate = { id: 'persisted-1', fullName: 'Private Candidate A', phone: '0901234567', shifts: ['ca1'], experience: 'none', status: 'pending', position: 'barista', createdAt: '2026-10-23' };
const fetchApplications = vi.fn();
const addCandidate = vi.fn();
const updateStatus = vi.fn();
const deleteApplication = vi.fn();
function setup(overrides = {}) {
  vi.mocked(useAdminRecruitmentStore).mockReturnValue({ applications: [candidate], pending: {}, loading: false, error: null,
    fetchApplications, addCandidate, updateStatus, deleteApplication, ...overrides } as any);
}
const fill = (name = 'Form A') => {
  fireEvent.change(screen.getByPlaceholderText('VD: Nguyễn Văn A'), { target: { value: name } });
  fireEvent.change(screen.getByPlaceholderText('VD: 0986470981'), { target: { value: '0901234567' } });
};
const submit = () => fireEvent.submit(screen.getByPlaceholderText('VD: Nguyễn Văn A').closest('form')!);
const deferred = () => { let resolve!: (body: boolean) => void; const promise = new Promise<boolean>(r => { resolve = r; }); return { resolve, promise }; };
beforeEach(() => {
  vi.clearAllMocks(); invalidateClientSession();
  saveClientSession('owner-a', { id: 'a', name: 'A', role: 'owner' }); setup();
});
describe('admin recruitment confirmation', () => {
  it('keeps unavailable distinct from empty and exposes retry', () => {
    setup({ applications: [], error: '503 unavailable' }); render(<RecruitmentTab />);
    expect(screen.getByText('503 unavailable')).toBeTruthy();
    expect(screen.queryByText('Chưa có hồ sơ ứng tuyển nào')).toBeNull();
    fireEvent.click(screen.getByText('Thử lại')); expect(fetchApplications).toHaveBeenCalledTimes(2);
  });
  it('catches rejected status/delete actions and preserves the visible candidate', async () => {
    updateStatus.mockRejectedValueOnce(new Error('Status 503')); deleteApplication.mockRejectedValueOnce(new Error('Delete 503'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<RecruitmentTab />);
    fireEvent.change(screen.getByLabelText('Trạng thái Private Candidate A'), { target: { value: 'hired' } });
    expect(await screen.findByText('Status 503')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Xóa hồ sơ'));
    expect(await screen.findByText('Delete 503')).toBeTruthy();
    expect(screen.getByText('Private Candidate A')).toBeTruthy();
  });
  it('keeps failed candidate form inputs and retries with the same key', async () => {
    addCandidate.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<RecruitmentTab />); fireEvent.click(screen.getByText('+ Nhập hồ sơ ứng viên')); fill(); submit();
    expect(await screen.findByText('Chưa xác nhận đã lưu hồ sơ. Vui lòng thử lại.')).toBeTruthy();
    expect(screen.getByDisplayValue('Form A')).toBeTruthy(); submit();
    await act(async () => {});
    expect(addCandidate.mock.calls[0]?.[1]).toBe(addCandidate.mock.calls[1]?.[1]);
    expect(screen.queryByPlaceholderText('VD: Nguyễn Văn A')).toBeNull();
  });
  it('resets candidate PII and ignores A’s late completion when B opens a new modal', async () => {
    const a = deferred(); const b = deferred(); addCandidate.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    render(<RecruitmentTab />); fireEvent.click(screen.getByText('+ Nhập hồ sơ ứng viên')); fill(); submit(); submit();
    expect(addCandidate).toHaveBeenCalledTimes(1);
    act(() => saveClientSession('manager-b', { id: 'b', name: 'B', role: 'manager' }));
    expect(screen.queryByDisplayValue('Form A')).toBeNull();
    fireEvent.click(screen.getByText('+ Nhập hồ sơ ứng viên')); fill('Form B'); submit();
    await act(async () => a.resolve(true));
    expect(screen.getByDisplayValue('Form B')).toBeTruthy();
    expect(screen.getByText('Đang lưu...').closest('button')).toBeDisabled();
    await act(async () => b.resolve(false));
    expect(screen.getByDisplayValue('Form B')).toBeTruthy();
  });
  it.each(['staff', 'admin', 'cashier', 'waiter', 'kitchen'])('hides direct recruitment rendering for %s', role => {
    saveClientSession('restricted', { id: 'restricted', role, name: 'R' });
    render(<RecruitmentTab />);
    expect(screen.queryByText('Private Candidate A')).toBeNull();
    expect(fetchApplications).not.toHaveBeenCalled();
  });
});
