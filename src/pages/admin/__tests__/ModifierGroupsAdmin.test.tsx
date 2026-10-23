import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

import { ModifierGroupList } from '../modifier-group-list';
import type { ModifierGroup } from '../types';

const GROUP: ModifierGroup = {
  id: 'MG-1',
  name: 'Kích cỡ',
  type: 'single',
  required: 0,
  sort_order: 0,
  is_active: 1,
};

describe('ModifierGroupList', () => {
  it('lists groups with their selection type', () => {
    renderWithProviders(
      <ModifierGroupList
        groups={[GROUP]}
        isLoading={false}
        isError={false}
        onRefetch={vi.fn()}
        onAdd={vi.fn()}
        onManageChoices={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('Kích cỡ')).toBeTruthy();
    expect(screen.getByText('adminMenu.modifierTypeSingle')).toBeTruthy();
  });

  it('shows the empty state instead of a blank table', () => {
    renderWithProviders(
      <ModifierGroupList
        groups={[]}
        isLoading={false}
        isError={false}
        onRefetch={vi.fn()}
        onAdd={vi.fn()}
        onManageChoices={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('adminMenu.emptyModifiers')).toBeTruthy();
  });

  it('routes delete through the confirm dialog, not straight to the API', () => {
    const onDelete = vi.fn();
    renderWithProviders(
      <ModifierGroupList
        groups={[GROUP]}
        isLoading={false}
        isError={false}
        onRefetch={vi.fn()}
        onAdd={vi.fn()}
        onManageChoices={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByText('adminMenu.deleteBtn'));
    // Deleting a group cascades its choices, so the list hands the row to a
    // confirmation step rather than firing the mutation on click.
    expect(onDelete).toHaveBeenCalledWith(GROUP);
  });

  it('offers retry when the groups query fails', () => {
    const onRefetch = vi.fn();
    renderWithProviders(
      <ModifierGroupList
        groups={[]}
        isLoading={false}
        isError
        onRefetch={onRefetch}
        onAdd={vi.fn()}
        onManageChoices={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('common.retry'));
    expect(onRefetch).toHaveBeenCalled();
  });
});
