import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReservations } from '@/hooks/use-reservations';
vi.mock('@/hooks/use-reservations', () => ({ useReservations: vi.fn() }));
const createBooking = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  createBooking.mockResolvedValue({ success: true, data: { id: 'rsv-saved', table_number: '5' } });
  vi.mocked(useReservations).mockReturnValue({ tables: [{ id: 'tbl5', table_number: '5', available: true, zone: 'Indoor' }], isLoadingTables: false, availabilityError: null, createReservation: vi.fn(), createReservationAsync: createBooking, isCreating: false, createError: null, refetchAvailability: vi.fn() });
});
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import ReservationNewPage from '../index';

describe('ReservationNewPage', () => {
  it('renders heading and 5 authentic container zones', () => {
    renderWithProviders(<ReservationNewPage />);
    expect(screen.getByRole('heading', { level: 1, name: /Đặt Bàn Trước/i })).toBeInTheDocument();
    expect(screen.getByText('Quầy Bar Container')).toBeInTheDocument();
    expect(screen.getByText('Phòng Container')).toBeInTheDocument();
    expect(screen.getByText('Sân Thượng Rooftop')).toBeInTheDocument();
    expect(screen.getByText('Cabin Yên Tĩnh')).toBeInTheDocument();
    expect(screen.getByText('Khu Sân Vườn Ngoài Trời')).toBeInTheDocument();
  });

  it('allows selecting guest count, date, time and zone', () => {
    renderWithProviders(<ReservationNewPage />);
    const guestOption = screen.getByRole('button', { name: '3 - 4 khách' });
    fireEvent.click(guestOption);
    expect(guestOption).toHaveClass('shadow-lg');

    const rooftopZone = screen.getByText('Sân Thượng Rooftop');
    fireEvent.click(rooftopZone);
  });

  it('submits booking form and displays booking confirmation card', async () => {
    renderWithProviders(<ReservationNewPage />);
    const nameInput = screen.getByLabelText(/HỌ VÀ TÊN/i);
    const phoneInput = screen.getByLabelText(/SỐ ĐIỆN THOẠI/i);
    const submitBtn = screen.getByRole('button', { name: /Xác Nhận Đặt Bàn Ngay/i });

    fireEvent.change(nameInput, { target: { value: 'Nguyễn Văn A' } });
    fireEvent.change(phoneInput, { target: { value: '0946013633' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('ĐẶT BÀN THÀNH CÔNG')).toBeInTheDocument();
    expect(screen.getByText('Cảm Ơn Quý Khách!')).toBeInTheDocument();
    expect(screen.getByText('rsv-saved')).toBeInTheDocument();
  });
  it.each(['no tables', 'loading', 'availability error', '400', '409', 'network', 'invalid response'])('fails closed for %s', async (reason) => {
    const state = vi.mocked(useReservations)('', '');
    if (reason === 'no tables') state.tables = [];
    else if (reason === 'loading') state.isLoadingTables = true;
    else if (reason === 'availability error') state.availabilityError = new Error('offline');
    else if (reason === 'invalid response') createBooking.mockResolvedValue({ success: false });
    else createBooking.mockRejectedValue(new Error(reason));
    renderWithProviders(<ReservationNewPage />);
    fireEvent.change(screen.getByLabelText(/HỌ VÀ TÊN/i), { target: { value: 'Guest' } });
    fireEvent.change(screen.getByLabelText(/SỐ ĐIỆN THOẠI/i), { target: { value: '0946013633' } });
    fireEvent.click(screen.getByRole('button', { name: /Xác Nhận Đặt Bàn Ngay/i }));
    if (reason !== 'loading') expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('ĐẶT BÀN THÀNH CÔNG')).not.toBeInTheDocument();
    expect(screen.queryByText(/DEMO-/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/HỌ VÀ TÊN/i)).toHaveValue('Guest');
  });

});
