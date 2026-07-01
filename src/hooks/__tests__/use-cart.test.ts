import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from '@/hooks/stores/use-cart-store';

describe('useCart (via useCartStore)', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset store by clearing items
    useCartStore.setState({ items: [] });
  });

  it('adds an item to the cart', () => {
    const store = useCartStore.getState();
    expect(store.items.length).toBe(0);

    store.addItem({ id: '1', name: 'Cà phê sữa đá', price: 35000 });
    const items = useCartStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0]?.name).toBe('Cà phê sữa đá');
    expect(items[0]?.quantity).toBe(1);
  });

  it('increments quantity when adding existing item', () => {
    const store = useCartStore.getState();
    store.addItem({ id: '1', name: 'Cà phê sữa đá', price: 35000 });
    store.addItem({ id: '1', name: 'Cà phê sữa đá', price: 35000 });

    const items = useCartStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0]?.quantity).toBe(2);
  });

  it('removes an item from the cart', () => {
    const store = useCartStore.getState();
    store.addItem({ id: '1', name: 'Cà phê sữa đá', price: 35000 });
    store.addItem({ id: '2', name: 'Cold Brew', price: 45000 });

    useCartStore.getState().removeItem('1');
    const items = useCartStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0]?.name).toBe('Cold Brew');
  });

  it('updates item quantity', () => {
    useCartStore.getState().addItem({ id: '1', name: 'Cà phê sữa đá', price: 35000 });
    useCartStore.getState().updateQuantity('1', 5);

    const items = useCartStore.getState().items;
    expect(items[0]?.quantity).toBe(5);
  });

  it('removes item when quantity set to 0', () => {
    useCartStore.getState().addItem({ id: '1', name: 'Cà phê sữa đá', price: 35000 });
    useCartStore.getState().updateQuantity('1', 0);

    expect(useCartStore.getState().items.length).toBe(0);
  });

  it('calculates totalItems count', () => {
    useCartStore.getState().addItem({ id: '1', name: 'Item 1', price: 35000 });
    useCartStore.getState().addItem({ id: '1', name: 'Item 1', price: 35000 });
    useCartStore.getState().addItem({ id: '2', name: 'Item 2', price: 45000 });

    expect(useCartStore.getState().totalItems()).toBe(3);
  });

  it('calculates subtotal correctly', () => {
    useCartStore.getState().addItem({ id: '1', name: 'Item 1', price: 35000 });
    useCartStore.getState().addItem({ id: '2', name: 'Item 2', price: 45000 });

    expect(useCartStore.getState().subtotal()).toBe(80000);
  });

  it('clears the cart', () => {
    useCartStore.getState().addItem({ id: '1', name: 'Item', price: 10000 });
    useCartStore.getState().addItem({ id: '2', name: 'Item 2', price: 20000 });

    useCartStore.getState().clearCart();
    expect(useCartStore.getState().items.length).toBe(0);
  });

  it('persists cart state across store operations', () => {
    useCartStore.getState().addItem({ id: '1', name: 'Item Persist', price: 50000 });
    useCartStore.getState().addItem({ id: '2', name: 'Item Persist 2', price: 30000 });

    expect(useCartStore.getState().items.length).toBe(2);

    useCartStore.getState().clearCart();
    expect(useCartStore.getState().items.length).toBe(0);
  });

  it('supports item with optional fields', () => {
    useCartStore.getState().addItem({
      id: '3',
      name: 'Special Coffee',
      price: 55000,
      image: '/images/coffee.jpg',
    });

    const items = useCartStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0]?.image).toBe('/images/coffee.jpg');
  });
});
