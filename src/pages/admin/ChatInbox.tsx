import { MessageCircle } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useChat, type ChatConversation, type ChatMessage } from '@/hooks/use-chat';
import { apiFetch } from '@/lib/api-client';

type ViewState = 'list' | 'detail';

export default function ChatInboxPage() {
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
      setListError(details || 'Khong the tai danh sach');
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
              Thu lai
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
            <div className="mb-2 text-4xl flex justify-center"><MessageCircle size={40} aria-hidden="true" className="text-muted" /></div>
            <p className="text-sm text-muted">Chua co tin nhan nao</p>
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
                  {conv.phone} &middot; {conv.message_count} tin nhan
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Detail view ──

interface ChatDetailViewProps {
  phone: string;
  name: string;
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  onBack: () => void;
}

function ChatDetailView({
  phone,
  name,
  messages,
  loading,
  error,
  onBack,
}: ChatDetailViewProps) {
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>(messages);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [forceUpdate, setForceUpdate] = useState(0);

  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages]);

  const handleSendReply = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!replyText.trim() || sending) return;

      setSending(true);
      setSendError(null);

      try {
        await apiFetch('/api/chat/messages', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Admin',
            phone,
            message: replyText.trim(),
          }),
        });

        const newMsg: ChatMessage = {
          id: Date.now(),
          name: 'Admin',
          phone,
          message: replyText.trim(),
          direction: 'admin',
          created_at: new Date().toISOString(),
        };

        setLocalMessages((prev) => [...prev, newMsg]);
        setReplyText('');
      } catch (err) {
        const details = err instanceof Error ? err.message : '';
        setSendError(details || 'Khong the gui tin nhan');
      } finally {
        setSending(false);
      }
    },
    [replyText, sending, phone]
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        {/* Back button */}
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7" />
          </svg>
          Quay lai
        </button>

        <div className="flex flex-col rounded-xl border border-border bg-white">
          {/* Customer info header */}
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-display font-bold text-foreground">{name}</h2>
            <p className="text-xs text-muted">{phone}</p>
          </div>

          {/* Messages area */}
          <div className="h-[400px] overflow-y-auto p-4">
            {loading && (
              <div className="flex h-full items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {!loading && localMessages.length === 0 && (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted">Chua co tin nhan nao</p>
              </div>
            )}

            {!loading && localMessages.length > 0 && (
              <div className="flex flex-col gap-2">
                {localMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'customer' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        msg.direction === 'customer'
                          ? 'rounded-br-md bg-blue-500 text-white'
                          : 'rounded-bl-md bg-gray-200 text-gray-800'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {msg.message}
                      </p>
                      <p
                        className={`mt-1 text-[10px] ${
                          msg.direction === 'customer'
                            ? 'text-blue-200'
                            : 'text-gray-500'
                        }`}
                      >
                        {new Date(msg.created_at).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Reply input */}
          <form
            onSubmit={handleSendReply}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <input
              type="text"
              placeholder="Nhap tin nhan tra loi..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              disabled={sending}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !replyText.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              aria-label="Gui"
            >
              {sending ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </form>

          {/* Send error */}
          {sendError && (
            <div className="border-t border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600">
              {sendError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
