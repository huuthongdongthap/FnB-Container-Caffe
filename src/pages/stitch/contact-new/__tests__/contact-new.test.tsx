import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import ContactNewPage from '../index';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, fallback?: string) => fallback ?? key ?? '',
    i18n: { language: 'vi' },
  }),
}));

vi.mock('lucide-react', () => ({
  MapPin: () => null,
  Phone: () => null,
  Mail: () => null,
  Clock: () => null,
  Send: () => null,
  CheckCircle2: () => null,
  Menu: () => null,
  X: () => null,
  ChevronDown: () => null,
  ArrowRight: () => null,
  Lock: () => null,
}));

describe('ContactNewPage', () => {
  it('renders contact title, address, phone and operating hours', () => {
    renderWithProviders(<ContactNewPage />);
    expect(screen.getByRole('heading', { level: 1, name: /Liên Hệ/i })).toBeInTheDocument();
    // Address may appear multiple times across the page sections — use getAllByText
    expect(screen.getAllByText(/39 Nguyễn Tất Thành/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('+84 946 013 633')).toBeInTheDocument();
    expect(screen.getByText(/06:00 — 23:00/i)).toBeInTheDocument();
  });

  it('submits contact form and renders success message', () => {
    renderWithProviders(<ContactNewPage />);

    const nameInput = screen.getByLabelText(/HỌ VÀ TÊN/i);
    const contactInput = screen.getByLabelText(/SỐ ĐIỆN THOẠI HOẶC EMAIL/i);
    const messageInput = screen.getByLabelText(/NỘI DUNG TIN NHẮN/i);
    const submitBtn = screen.getByRole('button', { name: /Gửi Tin Nhắn/i });

    fireEvent.change(nameInput, { target: { value: 'Khách hàng Sa Đéc' } });
    fireEvent.change(contactInput, { target: { value: '0901234567' } });
    fireEvent.change(messageInput, { target: { value: 'Quán rất đẹp, muốn đặt bàn 10 người.' } });
    fireEvent.click(submitBtn);

    expect(screen.getByText('Gửi Thành Công!')).toBeInTheDocument();
  });
});
