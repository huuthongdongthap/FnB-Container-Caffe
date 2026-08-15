import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '@/hooks/use-chat';
import { apiFetch } from '@/lib/api-client';
import type { ChatDetailViewProps } from './ChatInbox-types';

export function ChatDetailView({
  phone,
  name,
  messages,
  loading,
  error,
  onBack,
}: ChatDetailViewProps) {
  const { t } = useTranslation('chat');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>(messages);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        setSendError(details || t('sendError'));
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
          {t('back')}
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
                <p className="text-sm text-muted">{t('noMessages')}</p>
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
              placeholder={t('replyPlaceholder')}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              disabled={sending}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !replyText.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              aria-label={t('send')}
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
