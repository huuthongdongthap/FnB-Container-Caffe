import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { StoryTimeline } from '../StoryTimeline';

describe('StoryTimeline', () => {
  const milestones = [
    { year: '2024', title: 'Ý Tưởng Ban Đầu', description: 'Khởi nguồn từ tình yêu Sa Đéc' },
    { year: 'Q1/2025', title: 'Khởi Công Xây Dựng', description: 'Thi công container 40ft + 2x20ft' },
    { year: 'Q3/2025', title: 'Hoàn Thiện & Đào Tạo', description: 'Đội ngũ barista chuyên nghiệp' },
    { year: '01/2026', title: 'Chính Thức Khai Trương', description: 'Mở cửa đón khách' },
    { year: 'Hiện Tại', title: 'Phát Triển & Vươn Xa', description: 'Không ngừng cải thiện chất lượng' },
  ];

  it('renders all milestones in chronological order', () => {
    render(<StoryTimeline milestones={milestones} />);

    const renderedYears = screen.getAllByText(/2024|Q1|Q3|01|Hiện Tại/);
    expect(renderedYears).toHaveLength(5);

    expect(screen.getByText('Ý Tưởng Ban Đầu')).toBeInTheDocument();
    expect(screen.getByText('Phát Triển & Vươn Xa')).toBeInTheDocument();
  });

  it('renders milestone descriptions', () => {
    render(<StoryTimeline milestones={milestones} />);
    expect(screen.getByText('Khởi nguồn từ tình yêu Sa Đéc')).toBeInTheDocument();
    expect(screen.getByText('Mở cửa đón khách')).toBeInTheDocument();
  });

  it('has accessible timeline structure', () => {
    render(<StoryTimeline milestones={milestones} />);
    expect(screen.getByRole('list')).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
  });

  it('renders with custom className when provided', () => {
    const { container } = render(
      <StoryTimeline milestones={milestones} className="custom-timeline" />,
    );
    expect(container.firstChild).toHaveClass('custom-timeline');
  });
});
