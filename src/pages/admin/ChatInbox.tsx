import { MessageCircle } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useChat, type ChatConversation } from '@/hooks/use-chat';
import { apiFetch } from '@/lib/api-client';
import { ChatDetailView } from './ChatInbox-detail-view';
import type { ViewState } from './ChatInbox-types';

export type { ViewState, ChatDetailViewProps } from './ChatInbox-types';

export default function ChatInboxPage() {
  const { t } = useTranslation('chat');
  const [view, setView] = useState<ViewState>('list');
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string>('');
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    fetchMessages,
  } = useChat();

  const loadConversations = useCallback(async () => {
    setListLoading(true);
    setListError(null);

    try {
      const res = await apiFetch<{ success: boolean; data: ChatConversation[] }>(
        '/api/chat/conversations'
      );
      setConversations(res.data);
    } catch (err) {
      const details = err instanceof Error ? err.message : '';
      setListError(details || t('loadError'));
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleSelectConversation = useCallback(
    async (phone: string, name: string) => {
      setSelectedPhone(phone);
      setSelectedName(name);
      setView('detail');
      await fetchMessages(phone);
    },
    [fetchMessages]
  );

  if (view === 'detail' && selectedPhone) {
    return (
      <ChatDetailView
        phone={selectedPhone}
        name={selectedName}
        messages={messages}
        loading={messagesLoading}
        error={messagesError}
        onBack={() => {
          setView('list');
          loadConversations();
        }}
      />
    );
  }

  return (
    <>
      <HelmetHead
        title="Chat Inbox — Hộp thư hội thoại — AURA CAFE"
        description="Xem và trả lời tin nhắn hội thoại với khách hàng tại AURA CAFE. Customer chat inbox & conversation management."
      />
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 text-2xl font-display font-bold">Chat Inbox</h1>

          {/* Error state */}
          {listError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {listError}
              <button
                onClick={loadConversations}
                className="ml-3 underline hover:no-underline"
              >
                {t('retry')}
              </button>
            </div>
          )}

          {/* Loading state */}
          {listLoading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-xl border border-border bg-white p-4"
                >
                  <div className="mb-2 h-4 w-32 rounded bg-gray-200" />
                  <div className="h-3 w-64 rounded bg-gray-100" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!listLoading && !listError && conversations.length === 0 && (
            <div className="rounded-xl border border-border bg-white p-8 text-center">
              <div className="mb-2 text-4xl flex justify-center">
                <MessageCircle size={40} aria-hidden="true" className="text-muted" />
              </div>
              <p className="text-sm text-muted">{t('noMessages')}</p>
            </div>
          )}

          {/* Conversation list */}
          {!listLoading && conversations.length > 0 && (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.phone}
                  onClick={() => handleSelectConversation(conv.phone, conv.name)}
                  className="w-full rounded-xl border border-border bg-white p-4 text-left transition-colors hover:bg-accent/10"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {conv.name}
                      </span>
                      {conv.unread_count > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-white">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted">
                      {new Date(conv.last_message_at).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">
                    {conv.last_message}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {conv.phone} &middot; {t('messageCount', { count: conv.message_count })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
