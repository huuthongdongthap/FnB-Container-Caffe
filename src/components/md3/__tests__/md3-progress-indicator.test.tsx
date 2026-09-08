import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { MD3LinearProgress, MD3CircularProgress } from '../md3-progress-indicator';

describe('MD3LinearProgress', () => {
  it('renders as progressbar', () => {
    render(<MD3LinearProgress value={50} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('sets aria-valuenow when determinate', () => {
    render(<MD3LinearProgress value={75} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
  });

  it('sets aria-valuemin and aria-valuemax', () => {
    render(<MD3LinearProgress value={30} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('has no aria-valuenow when indeterminate', () => {
    render(<MD3LinearProgress />);
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  });

  it('clamps value to 0-100', () => {
    render(<MD3LinearProgress value={150} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('renders buffer indicator when buffer prop given', () => {
    const { container } = render(<MD3LinearProgress value={30} buffer={60} />);
    const track = container.querySelector('[class*="bg-md-on-surface/20"]');
    expect(track).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<MD3LinearProgress value={50} className="custom" />);
    expect(container.querySelector('.custom')).toBeInTheDocument();
  });
});

describe('MD3CircularProgress', () => {
  it('renders as progressbar', () => {
    render(<MD3CircularProgress value={50} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('sets aria-valuenow when determinate', () => {
    render(<MD3CircularProgress value={60} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60');
  });

  it('has no aria-valuenow when indeterminate', () => {
    render(<MD3CircularProgress />);
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  });

  it('uses custom size', () => {
    const { container } = render(<MD3CircularProgress size={64} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.width).toBe('64px');
    expect(wrapper.style.height).toBe('64px');
  });

  it('applies custom className', () => {
    const { container } = render(<MD3CircularProgress className="spin" />);
    expect(container.querySelector('.spin')).toBeInTheDocument();
  });

  it('defaults size to 48', () => {
    const { container } = render(<MD3CircularProgress />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.width).toBe('48px');
  });
});
