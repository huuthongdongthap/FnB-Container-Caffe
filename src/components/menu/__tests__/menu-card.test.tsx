import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { MenuCard } from '@/components/menu/menu-card';
import type { MenuItem } from '@/hooks/use-menu';

const BASE_ITEM: MenuItem = {
  id: 1,
  name: 'Cà phê sữa đá',
  description: 'Cà phê phin truyền thống với sữa đặc',
  price: 35000,
  category: 'coffee',
  available: true,
  tags: ['bestseller'],
  image: '',
};

describe('MenuCard', () => {
  it('renders name, price, and description', () => {
    render(<MenuCard item={BASE_ITEM} onAddToCart={() => {}} />);
    expect(screen.getByText('Cà phê sữa đá')).toBeInTheDocument();
    expect(screen.getByText(/35\.000/)).toBeInTheDocument();
    expect(screen.getByText('Cà phê phin truyền thống với sữa đặc')).toBeInTheDocument();
  });

  it('shows availability badge for unavailable items', () => {
    const unavailable = { ...BASE_ITEM, available: false };
    render(<MenuCard item={unavailable} onAddToCart={() => {}} />);
    expect(screen.getByText('Tạm hết')).toBeInTheDocument();
    const addButton = screen.getByRole('button', { name: /thêm/i });
    expect(addButton).toBeDisabled();
  });

  it('shows available item with enabled add-to-cart button', () => {
    render(<MenuCard item={BASE_ITEM} onAddToCart={() => {}} />);
    const addButton = screen.getByRole('button', { name: /thêm cà phê sữa đá/i });
    expect(addButton).not.toBeDisabled();
  });

  it('calls onAddToCart when add button clicked', () => {
    let clicked: MenuItem | null = null;
    render(<MenuCard item={BASE_ITEM} onAddToCart={(item) => { clicked = item; }} />);
    screen.getByRole('button', { name: /thêm cà phê sữa đá/i }).click();
    expect(clicked).toEqual(BASE_ITEM);
  });

  it('renders tags', () => {
    render(<MenuCard item={BASE_ITEM} onAddToCart={() => {}} />);
    expect(screen.getByText('bestseller')).toBeInTheDocument();
  });

  it('formats price in Vietnamese format', () => {
    render(<MenuCard item={{ ...BASE_ITEM, price: 45000 }} onAddToCart={() => {}} />);
    expect(screen.getByText(/45\.000/)).toBeInTheDocument();
  });
});
