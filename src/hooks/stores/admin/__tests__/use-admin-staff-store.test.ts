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
    useAdminStaffStore.setState({ staff: [], loading: false, error: null, pendingToggles: new Set() });
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

  it('fetchStaff(): normalizes Worker /api/auth/staff { users: [...] } snake_case response', async () => {
    mockSuccess({
      success: true,
      users: [
        {
          id: 'USR_01',
          email: 'barista@aura.vn',
          name: 'Tran Thi B',
          phone: '0909888777',
          role: 'staff',
          position: 'Barista',
          active: true,
          created_at: '2026-10-01T08:00:00Z',
        },
      ],
    });

    await useAdminStaffStore.getState().fetchStaff();

    const s = useAdminStaffStore.getState();
    expect(s.staff).toHaveLength(1);
    expect(s.staff[0]).toMatchObject({
      id: 'USR_01',
      name: 'Tran Thi B',
      role: 'Barista',
      phone: '0909888777',
      email: 'barista@aura.vn',
      isActive: true,
      startedAt: '2026-10-01T08:00:00Z',
    });
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

describe('toggleStaffActive', () => {
  const seedStaff = () => [
    { id: 'S001', name: 'A', role: 'staff', phone: '', email: '', isActive: true, startedAt: '' },
    { id: 'S002', name: 'B', role: 'staff', phone: '', email: '', isActive: true, startedAt: '' },
  ];

  beforeEach(() => {
    useAdminStaffStore.setState({
      staff: seedStaff(),
      loading: false,
      error: null,
      pendingToggles: new Set<string>(),
    });
    vi.restoreAllMocks();
    mockApiFetch.mockReset();
  });

  it('commits server state after a successful write', async () => {
    const refetch = vi.fn().mockResolvedValue([]);
    mockApiFetch.mockResolvedValueOnce({}).mockImplementation((path: string) =>
      path === '/api/auth/staff' ? refetch() : Promise.resolve({}),
    );

    await useAdminStaffStore.getState().toggleStaffActive('S001');

    expect(mockApiFetch).toHaveBeenNthCalledWith(1, '/api/staff/S001', {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false, is_active: 0, active: false }),
    });
    // Server is authoritative only after the write is accepted.
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(useAdminStaffStore.getState().pendingToggles.size).toBe(0);
  });

  it('reverts optimistic state and surfaces the error when the write fails', async () => {
    // Write fails; the post-failure refetch returns the server's list unchanged.
    mockApiFetch.mockRejectedValueOnce(new Error('Quyền không đủ')).mockResolvedValueOnce(seedStaff());

    await expect(useAdminStaffStore.getState().toggleStaffActive('S001')).rejects.toThrow('Quyền không đủ');

    const s = useAdminStaffStore.getState();
    expect(s.staff.find((m) => m.id === 'S001')?.isActive).toBe(true);
    expect(s.error).toContain('Quyền không đủ');
    expect(s.pendingToggles.size).toBe(0);
  });

  it('refetches after a failed write to reconcile with the server', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce([
      { id: 'S001', name: 'A', role: 'staff', phone: '', email: '', isActive: true, startedAt: '' },
      { id: 'S002', name: 'B', role: 'staff', phone: '', email: '', isActive: true, startedAt: '' },
    ]);

    await expect(useAdminStaffStore.getState().toggleStaffActive('S001')).rejects.toThrow('500');

    expect(mockApiFetch).toHaveBeenNthCalledWith(2, '/api/auth/staff');
    expect(useAdminStaffStore.getState().error).toContain('500');
  });

  it('keeps the rolled-back snapshot when the post-failure refetch also fails', async () => {
    mockApiFetch
      .mockRejectedValueOnce(new Error('Write rejected'))
      .mockRejectedValueOnce(new Error('Network down'));

    await expect(useAdminStaffStore.getState().toggleStaffActive('S001')).rejects.toThrow('Write rejected');

    const s = useAdminStaffStore.getState();
    expect(s.staff.find((m) => m.id === 'S001')?.isActive).toBe(true);
    // The original write failure stays the reported cause, not the refetch echo.
    expect(s.error).toContain('Write rejected');
  });

  it('drops a concurrent second toggle for the same staff id', async () => {
    let release!: () => void;
    mockApiFetch.mockImplementationOnce(() => new Promise((r) => { release = () => r({}); }));

    const first = useAdminStaffStore.getState().toggleStaffActive('S001');
    expect(useAdminStaffStore.getState().pendingToggles.has('S001')).toBe(true);

    // Second toggle for the same id is ignored while the first is in flight.
    await useAdminStaffStore.getState().toggleStaffActive('S001');
    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    release();
    await first;
    expect(useAdminStaffStore.getState().pendingToggles.size).toBe(0);
  });

  it('allows toggling two different staff members concurrently', async () => {
    const settles: Array<() => void> = [];
    mockApiFetch.mockImplementationOnce(() => new Promise((r) => { settles.push(() => r({})); }));
    mockApiFetch.mockImplementationOnce(() => new Promise((r) => { settles.push(() => r({})); }));
    // Refetch after each accepted write resolves immediately.
    mockApiFetch.mockResolvedValue([]);

    const a = useAdminStaffStore.getState().toggleStaffActive('S001');
    const b = useAdminStaffStore.getState().toggleStaffActive('S002');

    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    settles.forEach((resolve) => resolve());
    await Promise.all([a, b]);

    expect(mockApiFetch).toHaveBeenCalledWith('/api/staff/S002', expect.objectContaining({ method: 'PATCH' }));
  });

  it('ignores a toggle for an id that is not in the list', async () => {
    await useAdminStaffStore.getState().toggleStaffActive('UNKNOWN');
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('does not let an older refetch overwrite another staff member newer confirmed save', async () => {
    let releaseOlder!: (value: unknown) => void;
    let reads = 0;
    mockApiFetch.mockImplementation((path: string) => {
      if (path !== '/api/auth/staff') return Promise.resolve({});
      reads++;
      if (reads === 1) return new Promise(resolve => { releaseOlder = resolve; });
      return Promise.resolve(seedStaff().map(member => ({ ...member, isActive: false })));
    });
    const a = useAdminStaffStore.getState().toggleStaffActive('S001');
    await vi.waitFor(() => expect(reads).toBe(1));
    await useAdminStaffStore.getState().toggleStaffActive('S002');
    releaseOlder(seedStaff().map(member => member.id === 'S001' ? { ...member, isActive: false } : member));
    await a;
    expect(useAdminStaffStore.getState().staff.map(member => member.isActive)).toEqual([false, false]);
  });

  it('preserves B pending state through A refetch when B later saves but its refetch fails', async () => {
    let releaseB!: () => void;
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/staff/S002') return new Promise(resolve => { releaseB = () => resolve({}); });
      if (path === '/api/staff/S001') return Promise.resolve({});
      return Promise.resolve(seedStaff().map(member => member.id === 'S001' ? { ...member, isActive: false } : member));
    });
    const b = useAdminStaffStore.getState().toggleStaffActive('S002');
    await useAdminStaffStore.getState().toggleStaffActive('S001');
    expect(useAdminStaffStore.getState().staff[1]?.isActive).toBe(false);
    mockApiFetch.mockRejectedValueOnce(new Error('Refetch unavailable'));
    releaseB();
    await b;
    expect(useAdminStaffStore.getState().staff[1]?.isActive).toBe(false);
    expect(useAdminStaffStore.getState().error).toBe('Refetch unavailable');
  });
});
