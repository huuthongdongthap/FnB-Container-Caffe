import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import StitchKDS from '@/components/stitch/StitchKDS';

describe('StitchKDS', () => {
  it('renders loading state', () => {
    const { container } = render(<StitchKDS isLoading={true} />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state with retry button', () => {
    const onRefresh = vi.fn();
    render(<StitchKDS error="Connection lost" onRefresh={onRefresh} />);
    expect(screen.getByText('Connection Error')).toBeInTheDocument();
    expect(screen.getByText('Connection lost')).toBeInTheDocument();
    const retryBtn = screen.getByText('Retry');
    expect(retryBtn).toBeInTheDocument();
    retryBtn.click();
    expect(onRefresh).toHaveBeenCalled();
  });

  it('renders empty state with All Clear message', () => {
    const onRefresh = vi.fn();
    render(<StitchKDS tickets={[]} onRefresh={onRefresh} />);
    expect(screen.getByText('All Clear')).toBeInTheDocument();
    expect(screen.getByText(/No active tickets at this station/)).toBeInTheDocument();
  });

  it('renders default tickets when none provided', () => {
    render(<StitchKDS />);
    expect(screen.getByText('#9842')).toBeInTheDocument();
    expect(screen.getByText('TABLE B01 • DINE IN')).toBeInTheDocument();
    expect(screen.getByText('Midnight Espresso')).toBeInTheDocument();
  });

  it('renders ticket cards for provided tickets', () => {
    const tickets = [
      { id: '#T1', table: 'A1', type: 'DINE IN' as const, status: 'pending' as const, items: [{ name: 'Latte', quantity: 1 }], elapsedSeconds: 60 },
      { id: '#T2', table: 'A2', type: 'TOGO' as const, status: 'preparing' as const, items: [{ name: 'Espresso', quantity: 2 }], elapsedSeconds: 120 },
    ];
    render(<StitchKDS tickets={tickets} />);
    expect(screen.getByText('#T1')).toBeInTheDocument();
    expect(screen.getByText('#T2')).toBeInTheDocument();
    expect(screen.getByText('A1 • DINE IN')).toBeInTheDocument();
    expect(screen.getByText('A2 • TOGO')).toBeInTheDocument();
  });

  it('displays station info', () => {
    render(<StitchKDS stationName="GRILL & SAUTE" stationLabel="STATION 01" stationLoad={65} />);
    expect(screen.getAllByText(/GRILL/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('STATION 01').length).toBeGreaterThanOrEqual(1);
  });

  it('renders filter tabs', () => {
    render(<StitchKDS />);
    expect(screen.getByText('ALL')).toBeInTheDocument();
    expect(screen.getByText('PRIORITY')).toBeInTheDocument();
    expect(screen.getByText('PREPARING')).toBeInTheDocument();
    expect(screen.getByText('READY')).toBeInTheDocument();
  });

  it('calls onFilterChange when a filter tab is clicked', () => {
    const onFilterChange = vi.fn();
    render(<StitchKDS onFilterChange={onFilterChange} />);
    screen.getByText('PRIORITY').click();
    expect(onFilterChange).toHaveBeenCalledWith('priority');
  });
});
