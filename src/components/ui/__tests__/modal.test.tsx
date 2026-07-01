import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { Modal } from '@/components/ui/modal';

describe('Modal', () => {
  it('renders when open', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Test Modal">
        Modal content
      </Modal>,
    );
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        Should not render
      </Modal>,
    );
    expect(screen.queryByText('Should not render')).not.toBeInTheDocument();
  });

  it('renders title', () => {
    render(
      <Modal open={true} onClose={() => {}} title="My Title">
        Content
      </Modal>,
    );
    expect(screen.getByText('My Title')).toBeInTheDocument();
  });
});
