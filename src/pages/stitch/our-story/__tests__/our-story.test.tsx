import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import OurStoryPage from '../index';

describe('OurStoryPage', () => {
  it('renders hero title and authentic Sa Đéc address', () => {
    renderWithProviders(<OurStoryPage />);
    expect(screen.getByRole('heading', { level: 1, name: /Câu Chuyện/i })).toBeInTheDocument();
    expect(screen.getByText(/39 Nguyễn Tất Thành, Sa Đéc, Đồng Tháp/i)).toBeInTheDocument();
  });

  it('renders architectural narrative describing 3 containers and 5 zones', () => {
    renderWithProviders(<OurStoryPage />);
    expect(screen.getByText(/3 khối container hàng hải kiên cố, quy hoạch thành 5 không gian trải nghiệm/i)).toBeInTheDocument();
    expect(screen.getByText(/3 khối container được quy hoạch thành 5 không gian trải nghiệm thông minh/i)).toBeInTheDocument();
  });

  it('renders authentic founder and team members', () => {
    renderWithProviders(<OurStoryPage />);
    expect(screen.getByText('Nguyễn Hữu Còn')).toBeInTheDocument();
    expect(screen.getByText('Nhà Sáng Lập & Điều Hành')).toBeInTheDocument();
    expect(screen.getByText('Đội Ngũ Barista')).toBeInTheDocument();
    expect(screen.getByText('Đội Ngũ Phục Vụ')).toBeInTheDocument();

    // Verify sci-fi fake persona is NOT present
    expect(screen.queryByText('Elias Thorne')).not.toBeInTheDocument();
    expect(screen.queryByText('Sarah Chen')).not.toBeInTheDocument();
    expect(screen.queryByText('Nocturnal Pour')).not.toBeInTheDocument();
  });
});
