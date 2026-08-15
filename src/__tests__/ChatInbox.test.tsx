import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test-utils';
import ChatInboxPage from '@/pages/admin/ChatInbox';

/* ── Mocks ──────────────────────────────────────────────────────────── */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key?: string) => key ?? '', i18n: { language: 'vi' } }),
}));

vi.mock('lucide-react', () => ({
  MessageCircle: () => null,
}));

vi.mock('@/components/seo/HelmetHead', () => ({
  HelmetHead: () => null,
}));

const mockApiFetch = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock('@/hooks/use-chat', () => ({
  useChat: () => ({
    messages: [],
    loading: false,
    error: null,
    fetchMessages: vi.fn(),
  }),
}));

/* ── Helpers ────────────────────────────────────────────────────────── */

const MOCK_CONVERSATIONS = [
  {
    phone: '0901234567',
    name: 'Nguyen Van A',
    last_message: 'Xin chào, tôi muốn đặt bàn',
    last_direction: 'customer',
    last_message_at: '2025-08-10T14:30:00Z',
    message_count: 12,
    unread_count: 3,
  },
  {
    phone: '0912345678',
    name: 'Tran Thi B',
    last_message: 'Cảm ơn bạn',
    last_direction: 'admin',
    last_message_at: '2025-08-09T09:00:00Z',
    message_count: 5,
    unread_count: 0,
  },
];

/* ── Tests ──────────────────────────────────────────────────────────── */

describe('ChatInboxPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch.mockResolvedValue({ success: true, data: MOCK_CONVERSATIONS });
  });

  it('renders page heading', () => {
    renderWithProviders(<ChatInboxPage />);
    expect(screen.getByText('Chat Inbox')).toBeTruthy();
  });

  it('renders conversation list after loading', async () => {
    renderWithProviders(<ChatInboxPage />);
    await waitFor(() => {
      expect(screen.getByText('Nguyen Van A')).toBeTruthy();
    });
    expect(screen.getByText('Tran Thi B')).toBeTruthy();
  });

  it('shows unread count badge', async () => {
    renderWithProviders(<ChatInboxPage />);
    await waitFor(() => {
      expect(screen.getByText('Nguyen Van A')).toBeTruthy();
    });
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('shows empty state when no conversations', async () => {
    mockApiFetch.mockResolvedValue({ success: true, data: [] });
    renderWithProviders(<ChatInboxPage />);
    await waitFor(() => {
      expect(screen.getByText(/noMessages/)).toBeTruthy();
    });
  });

  it('shows error state on fetch failure', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network failure'));
    renderWithProviders(<ChatInboxPage />);
    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeTruthy();
    });
  });

  it('shows retry button on error', async () => {
    mockApiFetch.mockRejectedValue(new Error('Oops'));
    renderWithProviders(<ChatInboxPage />);
    await waitFor(() => {
      expect(screen.getByText(/retry/)).toBeTruthy();
    });
  });

  it('shows message count per conversation', async () => {
    renderWithProviders(<ChatInboxPage />);
    await waitFor(() => {
      expect(screen.getByText('Nguyen Van A')).toBeTruthy();
    });
    const countElements = screen.getAllByText(/messageCount/);
    expect(countElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows last message preview for each conversation', async () => {
    renderWithProviders(<ChatInboxPage />);
    await waitFor(() => {
      expect(screen.getByText('Xin chào, tôi muốn đặt bàn')).toBeTruthy();
    });
    expect(screen.getByText('Cảm ơn bạn')).toBeTruthy();
  });
});
