import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StaffPage from '../Staff';

const { fetchProfile, actor } = vi.hoisted(() => ({ fetchProfile: vi.fn(), actor: { id: 'manager', role: 'manager' } }));
vi.mock('@/lib/api-client', () => ({ apiFetch: fetchProfile }));
vi.mock('@/lib/server-confirmed-submission', () => ({ useSubmissionSession: () => 'session' }));
vi.mock('@/hooks/stores/use-auth-store', () => ({
  useAuthStore: (selector: (state: { user: { id: string; role: string } }) => unknown) => selector({ user: actor }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/seo/HelmetHead', () => ({ HelmetHead: () => null }));
vi.mock('../staff-list-tab', () => ({ StaffListTab: () => <div>Profiles</div> }));
vi.mock('../staff-shifts-tab', () => ({ ShiftsTab: () => <div>Attendance actions</div> }));
vi.mock('../staff-recruitment-tab', () => ({ RecruitmentTab: () => null }));

beforeEach(() => { vi.clearAllMocks(); actor.role = 'manager'; });
describe('staff management attendance capability', () => {
  it.each(['pilot_restricted', 'pilot_unconfigured'])('disables unavailable attendance for %s without hiding profiles', async reason => {
    fetchProfile.mockResolvedValue({ data: { shifts_availability: { available: false, reason } } });
    render(<StaffPage />);
    expect(await screen.findByRole('status')).toHaveTextContent('Attendance is not available');
    expect(screen.getByRole('button', { name: 'adminStaff.shifts' })).toBeDisabled();
    expect(screen.getByText('Profiles')).toBeInTheDocument();
    expect(screen.queryByText('Attendance actions')).not.toBeInTheDocument();
  });
  it('enables pilot attendance after capability loads', async () => {
    fetchProfile.mockResolvedValue({ data: { shifts_availability: { available: true } } });
    render(<StaffPage />);
    const button = screen.getByRole('button', { name: 'adminStaff.shifts' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(screen.getByText('Attendance actions')).toBeInTheDocument();
  });
  it.each(['staff', 'waiter', 'cashier'])('preserves pilot self-attendance for %s without management profile access', async role => {
    actor.role = role;
    fetchProfile.mockResolvedValue({ success: true, data: { shifts: [] } });
    render(<StaffPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'adminStaff.shifts' })).toBeEnabled());
    expect(fetchProfile).toHaveBeenCalledWith('/api/staff/shifts?limit=1');
  });
  it('fails closed and explains profile loading errors', async () => {
    fetchProfile.mockRejectedValue(new Error('Unavailable'));
    render(<StaffPage />);
    expect(await screen.findByRole('status')).toHaveTextContent('Unable to load attendance access');
    expect(screen.getByRole('button', { name: 'adminStaff.shifts' })).toBeDisabled();
  });
});
