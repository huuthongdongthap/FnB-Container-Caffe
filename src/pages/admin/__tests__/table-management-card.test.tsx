import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TableCard } from '../TableManagement-card';
import type { CafeTableRow } from '../TableManagement-types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue || key,
    i18n: { language: 'en' },
  }),
}));

const baseTable: CafeTableRow = {
  id: 'tbl-1',
  table_number: 'A1',
  zone: 'Indoor',
  capacity: 4,
  status: 'Overdue',
};

describe('TableCard regressions (#179)', () => {
  it('renders Release Table button for Overdue and lowercase occupied statuses', () => {
    const onRelease = vi.fn();
    const { rerender } = render(
      <TableCard
        table={baseTable}
        zone="Indoor"
        activeCount={0}
        isUpdating={false}
        onSetStatus={vi.fn()}
        onRelease={onRelease}
      />,
    );

    const releaseBtn = screen.getByRole('button', { name: 'admin.tableManagement.releaseTable' });
    fireEvent.click(releaseBtn);
    expect(onRelease).toHaveBeenCalledWith(baseTable);

    const lowerTable = { ...baseTable, status: 'occupied' as CafeTableRow['status'] };
    rerender(
      <TableCard
        table={lowerTable}
        zone="Indoor"
        activeCount={0}
        isUpdating={false}
        onSetStatus={vi.fn()}
        onRelease={onRelease}
      />,
    );
    expect(screen.getByRole('button', { name: 'admin.tableManagement.releaseTable' })).toBeTruthy();
  });

  it('toggles status menu on click without immediately cycling status', () => {
    const onSetStatus = vi.fn();
    render(
      <TableCard
        table={{ ...baseTable, status: 'Available' }}
        zone="Indoor"
        activeCount={0}
        isUpdating={false}
        onSetStatus={onSetStatus}
        onRelease={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Available/i });
    fireEvent.click(trigger);
    expect(onSetStatus).not.toHaveBeenCalled();

    const menuItems = screen.getAllByRole('menuitem');
    expect(menuItems.length).toBeGreaterThanOrEqual(4);

    const occupiedItem = menuItems.find((el) => /Occupied/i.test(el.textContent || ''));
    expect(occupiedItem).toBeTruthy();
    fireEvent.click(occupiedItem!);
    expect(onSetStatus).toHaveBeenCalledWith('tbl-1', 'Occupied');
  });
});
