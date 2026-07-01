import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test-utils';
import { CheckinForm } from '@/components/checkin/CheckinForm';
import { PhotoUpload } from '@/components/checkin/PhotoUpload';
import { ApprovalStatus } from '@/components/checkin/ApprovalStatus';

describe('CheckinForm', () => {
  it('renders phone input as first step', () => {
    render(<CheckinForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/số điện thoại/i)).toBeInTheDocument();
    expect(screen.getByText(/tiếp tục/i)).toBeInTheDocument();
  });

  it('validates phone number before proceeding', () => {
    const onSubmit = vi.fn();
    render(<CheckinForm onSubmit={onSubmit} />);

    const phoneInput = screen.getByLabelText(/số điện thoại/i);
    fireEvent.change(phoneInput, { target: { value: '123' } });
    fireEvent.click(screen.getByText(/tiếp tục/i));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/số điện thoại không hợp lệ/i)).toBeInTheDocument();
  });

  it('shows ineligible message when already checked in', () => {
    render(<CheckinForm ineligibleReason="already_checked_in_this_month" />);
    expect(screen.getByText(/đã check-in/i)).toBeInTheDocument();
  });

  it('shows ineligible message when no active campaign', () => {
    render(<CheckinForm ineligibleReason="no_active_campaign" />);
    expect(screen.getByText(/không có chương trình/i)).toBeInTheDocument();
  });
});

describe('PhotoUpload', () => {
  it('renders photo upload area', () => {
    render(<PhotoUpload onUpload={vi.fn()} />);
    // The upload area shows text "Chụp ảnh tại quán"
    expect(screen.getByText(/Chụp ảnh tại quán/)).toBeInTheDocument();
  });

  it('shows preview after file selection', () => {
    const onUpload = vi.fn();
    render(<PhotoUpload onUpload={onUpload} />);

    const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/chụp ảnh/i);
    fireEvent.change(input, { target: { files: [file] } });

    expect(onUpload).toHaveBeenCalledWith(file);
  });
});

describe('ApprovalStatus', () => {
  it('shows pending status', () => {
    render(<ApprovalStatus status="pending" />);
    expect(screen.getByText(/Đang xử lý/)).toBeInTheDocument();
  });

  it('shows approved status with reward info', () => {
    render(<ApprovalStatus status="approved" reward="+20.000đ" />);
    expect(screen.getByText(/Cảm ơn bạn đã check-in/)).toBeInTheDocument();
    expect(screen.getByText(/20\.000đ/)).toBeInTheDocument();
  });

  it('shows rejected status', () => {
    render(<ApprovalStatus status="rejected" />);
    expect(screen.getByText(/bị từ chối/)).toBeInTheDocument();
  });
});
