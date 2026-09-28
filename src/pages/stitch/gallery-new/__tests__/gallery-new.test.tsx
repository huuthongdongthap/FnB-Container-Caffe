import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import GalleryNewPage from '../index';

describe('GalleryNewPage', () => {
  it('renders heading and 3-zone description', () => {
    renderWithProviders(<GalleryNewPage />);
    expect(screen.getByRole('heading', { level: 1, name: /3 Khu Trải Nghiệm/i })).toBeInTheDocument();
    expect(screen.getByText(/Từ sân ngoài trời thoáng gió, tầng thượng ngắm sao, đến phòng container/i)).toBeInTheDocument();
  });

  it('renders zone filter buttons', () => {
    renderWithProviders(<GalleryNewPage />);
    expect(screen.getByRole('button', { name: 'TẤT CẢ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SÂN NGOÀI TRỜI' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ROOFTOP TẦNG THƯỢNG' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PHÒNG CONTAINER' })).toBeInTheDocument();
  });

  it('filters items when filter button clicked', () => {
    renderWithProviders(<GalleryNewPage />);
    const barFilter = screen.getByRole('button', { name: 'SÂN NGOÀI TRỜI' });
    fireEvent.click(barFilter);

    expect(screen.getByText('Quầy Bar Pha Chế & Đón Khách')).toBeInTheDocument();
    expect(screen.queryByText('AURA CAFE Lung Linh Về Đêm')).not.toBeInTheDocument();
  });

  it('opens and closes image modal on click', () => {
    renderWithProviders(<GalleryNewPage />);
    const itemCard = screen.getByText('Quầy Bar Pha Chế & Đón Khách');
    fireEvent.click(itemCard);

    const closeBtn = screen.getByRole('button', { name: 'Đóng ảnh' });
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('button', { name: 'Đóng ảnh' })).not.toBeInTheDocument();
  });
});
