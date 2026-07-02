import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import { MenuGrid } from '@/components/menu/menu-grid';
import type { MenuItem } from '@/hooks/use-menu';

const MOCK_ITEMS: MenuItem[] = [
  { id: 1, name: 'Cà phê sữa đá', description: 'Cà phê phin truyền thống với sữa đặc', price: 35000, category: 'coffee', available: true, tags: ['bestseller'], image: '' },
  { id: 2, name: 'Cold Brew', description: 'Ủ lạnh 12 tiếng', price: 45000, category: 'coffee', available: true, tags: [], image: '' },
  { id: 3, name: 'Trà đào', description: 'Trà đào cam sả', price: 39000, category: 'tea', available: false, tags: [], image: '' },
];

describe('MenuGrid', () => {
  it('renders menu items', () => {
    render(<MenuGrid items={MOCK_ITEMS} isLoading={false} onAddToCart={() => {}} />);
    expect(screen.getByText('Cà phê sữa đá')).toBeInTheDocument();
    expect(screen.getByText('Cold Brew')).toBeInTheDocument();
    expect(screen.getByText('Trà đào')).toBeInTheDocument();
  });

  it('filters by category via prop (API-driven filtering)', () => {
    const coffeeItems = MOCK_ITEMS.filter((i) => i.category === 'coffee');
    const { rerender } = render(<MenuGrid items={coffeeItems} isLoading={false} onAddToCart={() => {}} />);
    expect(screen.getByText('Cà phê sữa đá')).toBeInTheDocument();
    expect(screen.queryByText('Trà đào')).not.toBeInTheDocument();
    rerender(<MenuGrid items={MOCK_ITEMS.filter((i) => i.category === 'tea')} isLoading={false} onAddToCart={() => {}} />);
    expect(screen.getByText('Trà đào')).toBeInTheDocument();
    expect(screen.queryByText('Cold Brew')).not.toBeInTheDocument();
  });

  it('shows search results via prop filtering', () => {
    const searched = MOCK_ITEMS.filter((i) => i.name.toLowerCase().includes('cold'));
    render(<MenuGrid items={searched} isLoading={false} onAddToCart={() => {}} />);
    expect(screen.getByText('Cold Brew')).toBeInTheDocument();
    expect(screen.queryByText('Cà phê sữa đá')).not.toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(<MenuGrid items={[]} isLoading={false} onAddToCart={() => {}} />);
    expect(screen.getByText('Chưa có sản phẩm')).toBeInTheDocument();
  });

  it('shows loading skeletons', () => {
    const { container } = render(<MenuGrid items={[]} isLoading={true} onAddToCart={() => {}} />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(8);
  });

  it('calls onAddToCart when add button clicked', () => {
    const onAddToCart = vi.fn();
    render(<MenuGrid items={MOCK_ITEMS} isLoading={false} onAddToCart={onAddToCart} />);
    const buttons = screen.getAllByRole('button', { name: /thêm/i });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    buttons[0]?.click();
    expect(onAddToCart).toHaveBeenCalledWith(MOCK_ITEMS[0]);
  });
});
