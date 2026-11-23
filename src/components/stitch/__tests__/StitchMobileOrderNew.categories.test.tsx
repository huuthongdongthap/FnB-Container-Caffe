import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StitchMobileOrderNew } from '../StitchMobileOrderNew';
import type { MenuItem } from '../StitchMobileOrderNew-types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key,
  }),
}));

const LIVE_D1_ITEMS: MenuItem[] = [
  {
    id: 'item_1',
    name: 'Cà phê sữa đá',
    description: 'Đậm đà',
    price: 25000,
    priceLabel: '25.000₫',
    category: 'cat_coffee',
    imageSrc: '/coffee.webp',
    imageAlt: 'Cà phê sữa đá',
  },
  {
    id: 'item_2',
    name: 'Trà đào cam sả',
    description: 'Thanh mát',
    price: 30000,
    priceLabel: '30.000₫',
    category: 'cat_tea',
    imageSrc: '/tea.webp',
    imageAlt: 'Trà đào cam sả',
  },
];

describe('StitchMobileOrderNew live D1 category filter', () => {
  it('derives category tabs from live cat_* items and filters items accurately', () => {
    render(<StitchMobileOrderNew items={LIVE_D1_ITEMS} tableId="B01" />);

    expect(screen.getByText('Cà phê sữa đá')).toBeTruthy();
    expect(screen.getByText('Trà đào cam sả')).toBeTruthy();

    const coffeeTab = screen.getByRole('button', { name: 'Filter by Coffee' });
    const teaTab = screen.getByRole('button', { name: 'Filter by Trà' });
    expect(coffeeTab).toBeTruthy();
    expect(teaTab).toBeTruthy();

    fireEvent.click(coffeeTab);
    expect(screen.getByText('Cà phê sữa đá')).toBeTruthy();
    expect(screen.queryByText('Trà đào cam sả')).toBeNull();

    fireEvent.click(teaTab);
    expect(screen.getByText('Trà đào cam sả')).toBeTruthy();
    expect(screen.queryByText('Cà phê sữa đá')).toBeNull();
  });
});
