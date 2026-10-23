import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DrinkCustomizerModal } from '../DrinkCustomizerModal';
import type { MenuItemData } from '@/components/stitch/StitchMenuNew-types';

const baseItem: MenuItemData = {
  id: 'tc001',
  name: 'Cà phê sữa đá',
  description: '',
  price: '29.000₫',
  imageSrc: '',
  imageAlt: 'Cà phê sữa đá',
  category: 'traditional-coffee',
  tags: ['Iced/Hot'],
};

const itemFor = (overrides: Partial<MenuItemData>): MenuItemData => ({ ...baseItem, ...overrides });

interface ConfirmPayload {
  quantity: number;
  finalPrice: number;
  modifiers: string[];
  notes: string;
}

/** The single payload the modal handed back, typed so callers can assert on fields. */
function confirmed(spy: ReturnType<typeof vi.fn>): ConfirmPayload {
  const call = spy.mock.calls[0]?.[0] as ConfirmPayload | undefined;
  if (!call) throw new Error('onConfirm was never called');
  return call;
}

beforeEach(() => {
  cleanup();
});

describe('DrinkCustomizerModal — bypass', () => {
  it('renders nothing for a bottled item (served as-is)', () => {
    const { container } = render(
      <DrinkCustomizerModal
        item={itemFor({ category: 'bottled', tags: ['Bottled'] })}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the modal is closed', () => {
    const { container } = render(
      <DrinkCustomizerModal item={baseItem} isOpen={false} onClose={() => {}} onConfirm={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('bypasses the live-catalog id for a packaged yogurt cup', () => {
    const { container } = render(
      <DrinkCustomizerModal
        item={itemFor({ id: 'yg004', name: 'Yaourt hủ', category: 'yogurt', tags: ['Original'] })}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

/**
 * Section titles in render order, number prefix stripped. Option groups are `<h4>`
 * and the notes prompt is a `<label>`, so both are collected to assert the sequence.
 */
function sectionTitles(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('h4, label')).map((el) =>
    (el.textContent ?? '').replace(/^\d+\.\s*/, ''),
  );
}

/** Same as above but keeps the "N. Title" numbering, to check for gaps. */
function numberedSections(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('h4, label')).map((el) => el.textContent ?? '');
}

describe('DrinkCustomizerModal — option groups per category', () => {
  it('hot coffee offers sweetness and notes but no ice', () => {
    const { container } = render(
      <DrinkCustomizerModal
        item={itemFor({ category: 'hot-coffee', tags: ['Hot'] })}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.queryByText(/Mức đá/)).toBeNull();
    expect(sectionTitles(container)).toEqual(['Độ ngọt (Đường)', 'Ghi chú thêm cho quầy bar']);
  });

  it('frappuccino offers notes only — no sweetness, no ice', () => {
    const { container } = render(
      <DrinkCustomizerModal
        item={itemFor({ category: 'frappuccino', tags: ['Blended'] })}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.queryByText(/Độ ngọt/)).toBeNull();
    expect(screen.queryByText(/Mức đá/)).toBeNull();
    expect(sectionTitles(container)).toEqual(['Ghi chú thêm cho quầy bar']);
  });

  it('traditional coffee offers sweetness, ice and notes', () => {
    const { container } = render(
      <DrinkCustomizerModal item={baseItem} isOpen onClose={() => {}} onConfirm={() => {}} />,
    );
    expect(sectionTitles(container)).toEqual([
      'Độ ngọt (Đường)',
      'Mức đá',
      'Ghi chú thêm cho quầy bar',
    ]);
  });

  it('numbers the notes section off the groups that actually render', () => {
    const { container } = render(
      <DrinkCustomizerModal
        item={itemFor({ category: 'hot-coffee', tags: ['Hot'] })}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(numberedSections(container)).toEqual([
      '1. Độ ngọt (Đường)',
      '2. Ghi chú thêm cho quầy bar',
    ]);
  });

  it('leaves no numbering gap when only one group renders', () => {
    const { container } = render(
      <DrinkCustomizerModal
        item={itemFor({ category: 'frappuccino', tags: ['Blended'] })}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(numberedSections(container)).toEqual(['1. Ghi chú thêm cho quầy bar']);
  });
});

describe('DrinkCustomizerModal — removed options', () => {
  it.each(['traditional-coffee', 'tea', 'soda'])('offers no size or topping for %s', (category) => {
    render(
      <DrinkCustomizerModal
        item={itemFor({ category, tags: ['Iced'] })}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.queryByText(/kích cỡ|Kích cỡ|Size/i)).toBeNull();
    expect(screen.queryByText(/Topping/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Kem cheese|Trân châu|Thạch cà phê/i })).toBeNull();
    // Pin the section count, not just the absence of the old labels — a resurrected
    // group under a different heading would otherwise slip past the regexes above.
    expect(numberedSections(screen.getByRole('dialog'))).toEqual([
      '1. Độ ngọt (Đường)',
      '2. Mức đá',
      '3. Ghi chú thêm cho quầy bar',
    ]);
  });

  it('prices an item exactly as the menu lists it', async () => {
    const onConfirm = vi.fn();
    render(<DrinkCustomizerModal item={baseItem} isOpen onClose={() => {}} onConfirm={onConfirm} />);

    // The footer shows the menu price; no surcharge may creep into it.
    expect(screen.getAllByText('29.000₫', { exact: false }).length).toBeGreaterThan(0);

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /Thêm vào giỏ/ }));
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(confirmed(onConfirm).finalPrice).toBe(29000);
  });

  it('keeps the posted price flat when the quantity rises', async () => {
    const onConfirm = vi.fn();
    render(<DrinkCustomizerModal item={baseItem} isOpen onClose={() => {}} onConfirm={onConfirm} />);

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }));
    });
    // Header keeps the unit price; only the footer total moves. This is the exact
    // shape that regresses if unitPrice = basePrice + surcharge is reintroduced.
    expect(screen.getAllByText('29.000₫')).toHaveLength(1);
    expect(screen.getByText('58.000₫')).toBeTruthy();

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /Thêm vào giỏ/ }));
    });
    const payload = confirmed(onConfirm);
    expect(payload.finalPrice).toBe(29000);
    expect(payload.quantity).toBe(2);
  });
});

describe('DrinkCustomizerModal — switching items', () => {
  it('resets the picks to the new item defaults', async () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <DrinkCustomizerModal item={baseItem} isOpen onClose={() => {}} onConfirm={onConfirm} />,
    );

    await act(async () => {
      await userEvent.click(screen.getByText('Không đường'));
      await userEvent.click(screen.getByText('Uống nóng'));
    });

    // Switch to a hot coffee: sweetness carries (same group), ice must not — the new
    // item has no ice group at all.
    rerender(
      <DrinkCustomizerModal
        item={itemFor({ id: 'hc001', name: 'Cà phê nóng', category: 'hot-coffee', tags: ['Hot'] })}
        isOpen
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.queryByText('Uống nóng')).toBeNull();
    expect(numberedSections(screen.getByRole('dialog'))).toEqual([
      '1. Độ ngọt (Đường)',
      '2. Ghi chú thêm cho quầy bar',
    ]);

    // The DOM alone can't prove the reset: a stale sweetness string that no longer
    // matches any chip still renders as "nothing selected". Assert the payload —
    // 'Không đường' was picked on the first item and must not survive the switch.
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /Thêm vào giỏ/ }));
    });
    expect(confirmed(onConfirm).modifiers).toEqual(['100% đường (chuẩn)']);
  });

  it('drops a stale pick that no longer belongs to the new item options', async () => {
    const { rerender } = render(
      <DrinkCustomizerModal item={baseItem} isOpen onClose={() => {}} onConfirm={() => {}} />,
    );

    // Pick the ice option that only exists on full-ice drinks.
    await act(async () => {
      await userEvent.click(screen.getByText('Uống nóng'));
    });
    expect(screen.getByText('Uống nóng')).toBeTruthy();

    rerender(
      <DrinkCustomizerModal
        item={itemFor({ id: 'sd001', name: 'Soda Ý', category: 'soda', tags: ['Iced'] })}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(screen.queryByText('Uống nóng')).toBeNull();
    // Soda's ice set has only two steps; the first is selected by default.
    const sodaIce = screen.getAllByRole('button', { name: 'Đá thường (chuẩn)' });
    expect(sodaIce.length).toBe(1);
  });
});

describe('DrinkCustomizerModal — no state leaks between items', () => {
  it('clears the bar note when switching from a notes-only drink', async () => {
    const { rerender } = render(
      <DrinkCustomizerModal
        item={itemFor({ id: 'fp001', name: 'Frappu', category: 'frappuccino', tags: ['Blended'] })}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    await act(async () => {
      await userEvent.type(screen.getByRole('textbox'), 'note-frappe');
    });
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('note-frappe');

    rerender(
      <DrinkCustomizerModal
        item={itemFor({ id: 'hc001', name: 'Latte', category: 'hot-coffee', tags: ['Hot'] })}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
    expect(screen.queryByText(/Độ ngọt/)).toBeTruthy();
  });

  it('drops an ice pick that the new item\'s set does not contain', async () => {
    const { rerender } = render(
      <DrinkCustomizerModal
        item={itemFor({ id: 'hc001', name: 'Latte', category: 'hot-coffee', tags: ['Hot'] })}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    // Hot coffee has no ice group, so nothing stale can carry yet — move to the
    // widest set first, then narrow to tea's 3-step set which lacks 'Uống nóng'.
    rerender(
      <DrinkCustomizerModal item={baseItem} isOpen onClose={() => {}} onConfirm={() => {}} />,
    );
    await act(async () => {
      await userEvent.click(screen.getByText('Uống nóng'));
    });
    expect(screen.getByText('Uống nóng')).toBeTruthy();

    rerender(
      <DrinkCustomizerModal
        item={itemFor({ id: 'te001', name: 'Lipton', category: 'tea', tags: ['Iced/Hot'] })}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.queryByText('Uống nóng')).toBeNull();
  });

  it('resets the quantity when switching to another item', async () => {
    const { rerender } = render(
      <DrinkCustomizerModal item={baseItem} isOpen onClose={() => {}} onConfirm={() => {}} />,
    );
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }));
    });
    expect(screen.getByText('58.000₫')).toBeTruthy();

    rerender(
      <DrinkCustomizerModal
        item={itemFor({ id: 'tc002', name: 'Cà phê sữa máy' })}
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.queryByText('58.000₫')).toBeNull();
    // The price appears twice by design — header and confirm button. Quantity is back
    // to 1, so both read the single-unit price.
    expect(screen.getAllByText('29.000₫', { exact: false })).toHaveLength(2);
  });
});
