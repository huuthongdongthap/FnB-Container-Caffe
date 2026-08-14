import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/use-focus-trap', () => ({
  useFocusTrap: vi.fn(),
}));

import { StitchAdminTerminalNew } from '../StitchAdminTerminalNew';

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/admin']}>{ui}</MemoryRouter>,
  );
}

describe('StitchAdminTerminalNew', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders brand subtitle', () => {
    renderWithRouter(<StitchAdminTerminalNew />);
    expect(screen.getByText('Admin Terminal')).toBeInTheDocument();
  });

  it('renders admin name', () => {
    renderWithRouter(<StitchAdminTerminalNew />);
    expect(screen.getByText('Aura Admin')).toBeInTheDocument();
  });

  it('renders sidebar nav items with Vietnamese labels', () => {
    renderWithRouter(<StitchAdminTerminalNew />);
    expect(screen.getByText('Đơn hàng')).toBeInTheDocument();
    expect(screen.getByText('POS')).toBeInTheDocument();
    expect(screen.getByText('Thực đơn')).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    renderWithRouter(
      <StitchAdminTerminalNew>
        <div>Dashboard Content</div>
      </StitchAdminTerminalNew>,
    );
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  it('renders main content area', () => {
    renderWithRouter(<StitchAdminTerminalNew />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderWithRouter(<StitchAdminTerminalNew />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});
