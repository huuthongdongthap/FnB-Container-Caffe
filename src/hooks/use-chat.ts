import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api-client';

export interface ChatMessage {
  id: number;
  name: string;
  phone: string;
  message: string;
  direction: 'customer' | 'admin';
  created_at: string;
  read_at?: string | null;
}

export interface ChatConversation {
  phone: string;
  name: string;
  last_message: string;
  last_direction: string;
  last_message_at: string;
  message_count: number;
  unread_count: number;
}

interface SendMessageState {
  sending: boolean;
  sent: boolean;
  error: string | null;
}

export function useChat() {
  const [sendState, setSendState] = useState<SendMessageState>({
    sending: false,
    sent: false,
    error: null,
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (name: string, phone: string, text: string) => {
    setSendState({ sending: true, sent: false, error: null });

    try {
      const res = await apiFetch<{ success: boolean }>('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({ name, phone, message: text }),
      });

      if (res.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            name,
            phone,
            message: text,
            direction: 'customer',
            created_at: new Date().toISOString(),
          },
        ]);
      }

      setSendState({ sending: false, sent: true, error: null });
    } catch (err) {
      const details = err instanceof Error ? err.message : '';
      setSendState({ sending: false, sent: false, error: details || 'Khong the gui tin nhan' });
    }
  }, []);

  const fetchMessages = useCallback(async (phone: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch<{ success: boolean; data: ChatMessage[] }>(
        `/api/chat/messages/${encodeURIComponent(phone)}`
      );
      setMessages(res.data.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    } catch (err) {
      const details = err instanceof Error ? err.message : '';
      setError(details || 'Khong the tai tin nhan');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch<{ success: boolean; data: ChatConversation[] }>(
        '/api/chat/conversations'
      );
      return res.data;
    } catch (err) {
      const details = err instanceof Error ? err.message : '';
      setError(details || 'Khong the tai danh sach');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const resetSendState = useCallback(() => {
    setSendState({ sending: false, sent: false, error: null });
  }, []);

  return {
    sendMessage,
    sendState,
    messages,
    loading,
    error,
    fetchMessages,
    fetchConversations,
    resetSendState,
  };
}
