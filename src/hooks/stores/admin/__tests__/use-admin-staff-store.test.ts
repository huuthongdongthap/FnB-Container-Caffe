import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAdminStaffStore } from '@/hooks/stores/admin/use-admin-staff-store';

const mockApiFetch = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

function mockSuccess(data: unknown) {
  mockApiFetch.mockResolvedValue(data);
}

function mockError(message: string) {
  mockApiFetch.mockRejectedValue(new Error(message));
}

describe('useAdminStaffStore', () => {
  beforeEach(() => {
    useAdminStaffStore.setState({ staff: [], loading: false, error: null });
    vi.restoreAllMocks();
    mockApiFetch.mockReset();
  });

  it('starts with empty staff, loading=false, error=null', () => {
    const s = useAdminStaffStore.getState();
    expect(s.staff).toEqual([]);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchStaff(): populates staff on success', async () => {
    const fakeStaff = [
      { id: 'S001', name: 'Nguyen Van A', role: 'Quan ly', phone: '0901234567', email: 'a@aura.vn', isActive: true, startedAt: '2024-01-15' },
    ];
    mockSuccess(fakeStaff);

    await useAdminStaffStore.getState().fetchStaff();

    const s = useAdminStaffStore.getState();
    expect(s.staff).toEqual(fakeStaff);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchStaff(): wraps array response in array', async () => {
    const fakeStaff = [
      { id: 'S001', name: 'Nguyen Van A', role: 'Quan ly', phone: '0901234567', email: 'a@aura.vn', isActive: true, startedAt: '2024-01-15' },
    ];
    mockSuccess({ staff: fakeStaff });

    await useAdminStaffStore.getState().fetchStaff();

    expect(useAdminStaffStore.getState().staff).toEqual(fakeStaff);
  });

  it('fetchStaff(): sets error on failure', async () => {
    mockError('Không thể tải danh sách nhân viên');

    await useAdminStaffStore.getState().fetchStaff();

    expect(useAdminStaffStore.getState().error).toContain('Không thể tải danh sách nhân viên');
  });

  it('registerStaff(): calls apiFetch with POST', async () => {
    mockSuccess({});
    mockSuccess([]);

    await useAdminStaffStore.getState().registerStaff({
      name: 'New Staff',
      role: 'Phuc vu',
      phone: '0901234567',
      email: 'new@aura.vn',
      password: 'pass123',
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/auth/register-staff', {
      method: 'POST',
      body: JSON.stringify({
        name: 'New Staff',
        role: 'Phuc vu',
        phone: '0901234567',
        email: 'new@aura.vn',
        password: 'pass123',
      }),
    });
  });
});
