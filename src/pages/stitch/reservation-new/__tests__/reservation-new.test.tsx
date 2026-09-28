import { describe, it, expect } from 'vitest';
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

  it('submits booking form and displays booking confirmation card', () => {
    renderWithProviders(<ReservationNewPage />);
    const nameInput = screen.getByLabelText(/HỌ VÀ TÊN/i);
    const phoneInput = screen.getByLabelText(/SỐ ĐIỆN THOẠI/i);
    const submitBtn = screen.getByRole('button', { name: /Xác Nhận Đặt Bàn Ngay/i });

    fireEvent.change(nameInput, { target: { value: 'Nguyễn Văn A' } });
    fireEvent.change(phoneInput, { target: { value: '0946013633' } });
    fireEvent.click(submitBtn);

    expect(screen.getByText('ĐẶT BÀN THÀNH CÔNG')).toBeInTheDocument();
    expect(screen.getByText('Cảm Ơn Quý Khách!')).toBeInTheDocument();
    expect(screen.getByText(/(AURA|DEMO)-\d{4}/)).toBeInTheDocument();
  });
});
