import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '@/test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'broadcast.title': 'Broadcast Messaging',
        'broadcast.subtitle': 'Send bulk messages to customers',
        'broadcast.segmentLabel': 'Customer Segment',
        'broadcast.selectSegment': 'Select a segment',
        'broadcast.channelLabel': 'Channel',
        'broadcast.channelZns': 'ZNS',
        'broadcast.channelSms': 'SMS',
        'broadcast.channelEmail': 'Email',
        'broadcast.channelAll': 'All Channels',
        'broadcast.channelAllDesc': 'All Channels',
        'broadcast.titleLabel': 'Title',
        'broadcast.titlePlaceholder': 'Enter campaign title',
        'broadcast.messageLabel': 'Message',
        'broadcast.messagePlaceholder': 'Type your message...',
        'broadcast.charCount': '{{count}} characters',
        'broadcast.preview': 'Preview: {{count}} customers via {{channel}}',
        'broadcast.send': 'Send Broadcast',
        'broadcast.sending': 'Sending...',
        'broadcast.confirmTitle': 'Confirm Broadcast',
        'broadcast.details': 'Broadcast Details',
        'broadcast.segment': 'Segment',
        'broadcast.quantity': 'Quantity',
        'broadcast.customers': 'customers',
        'broadcast.channel': 'Channel',
        'broadcast.messageContent': 'Message Content',
        'broadcast.confirmWarning': 'This will send to {{count}} customers',
        'broadcast.confirm': 'Confirm & Send',
        'broadcast.cancel': 'Cancel',
        'broadcast.sendResult': 'Broadcast Result',
        'broadcast.sendSuccess': 'Broadcast sent successfully',
        'broadcast.sendStats': 'Sent: {{sent}}, Failed: {{failed}}, Total: {{total}}',
        'broadcast.sendingBg': 'Sending in background...',
        'broadcast.totalCustomers': '{{total}} customers via {{channels}}',
        'broadcast.skippedChannels': 'Skipped channels',
        'broadcast.sendAgain': 'Send Another',
        'broadcast.error': 'Send failed',
        'broadcast.retry': 'Retry',
      };
      let text = map[key ?? ''] ?? key ?? '';
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          text = text.replaceAll(`{{${k}}}`, String(v));
        }
      }
      return text;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/use-broadcast', () => ({
  useSegments: vi.fn(),
  useSendBroadcast: vi.fn(),
}));

import { useSegments, useSendBroadcast } from '@/hooks/use-broadcast';
import BroadcastPage from '@/pages/admin/BroadcastPage';

const MOCK_SEGMENTS = [
  { id: 'seg-1', name: 'VIP Customers', count: 150 },
  { id: 'seg-2', name: 'All Members', count: 1200 },
];

function setupMocks(overrides: { segments?: any[]; sendMutation?: Partial<ReturnType<typeof useSendBroadcast>> } = {}) {
  vi.mocked(useSegments).mockReturnValue({
    data: overrides.segments ?? MOCK_SEGMENTS,
    isLoading: false,
  } as any);
  vi.mocked(useSendBroadcast).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    data: null,
    error: null,
    reset: vi.fn(),
    ...overrides.sendMutation,
  } as any);
}

describe('BroadcastPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders page title', () => {
    renderWithProviders(<BroadcastPage />);
    expect(screen.getByText('Broadcast Messaging')).toBeTruthy();
  });

  it('renders segment selector with options', () => {
    renderWithProviders(<BroadcastPage />);
    const select = screen.getByRole('combobox');
    expect(select).toBeTruthy();
    // Segment counts use toLocaleString('vi-VN') formatting
    expect(screen.getByText(/VIP Customers/)).toBeTruthy();
    expect(screen.getByText(/All Members/)).toBeTruthy();
  });

  it('renders channel radio options', () => {
    renderWithProviders(<BroadcastPage />);
    expect(screen.getByText('ZNS')).toBeTruthy();
    expect(screen.getByText('SMS')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
  });

  it('renders message textarea with character count', () => {
    renderWithProviders(<BroadcastPage />);
    const textarea = screen.getByPlaceholderText('Type your message...');
    expect(textarea).toBeTruthy();
    expect(screen.getByText('0 characters')).toBeTruthy();
  });

  it('send button is disabled when form is incomplete', () => {
    renderWithProviders(<BroadcastPage />);
    const sendButton = screen.getByText('Send Broadcast');
    expect(sendButton.closest('button')).toBeDisabled();
  });
});
