import { type ChatWidgetProps } from './ChatWidget-types';
import { useChatWidget } from './ChatWidget-hooks';
import { ChatBubble } from './ChatBubble';

export function ChatWidget({ baseUrl }: ChatWidgetProps) {
  const {
    t, isOpen, setIsOpen, name, setName, phone, setPhone,
    showForm, inputText, setInputText, unreadCount, messages,
    sendState, messagesEndRef, panelRef, inputRef,
    handleSaveInfo, handleSend, handleToggle,
  } = useChatWidget();

  return (
    <>
      {/* Floating toggle button */}
      <button
        data-chat-toggle
        onClick={handleToggle}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
        aria-label={isOpen ? 'Dong chat' : 'Mo chat'}
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}

        {/* Unread badge */}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="fixed bottom-24 right-6 z-50 flex w-[min(350px,calc(100vw-48px))] max-h-[500px] flex-col rounded-2xl border border-border bg-[#0A1628] shadow-2xl"
          style={{ maxHeight: 'min(500px, calc(100vh - 160px))' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-primary to-secondary px-4 py-3 text-white">
            <div>
              <h3 className="font-display text-base font-bold">AURA CAFE Support</h3>
              <p className="text-xs text-accent/80">Tra loi trong vai phut</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="Dong"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4" style={{ minHeight: 0 }}>
            {showForm ? (
              <form onSubmit={handleSaveInfo} className="flex flex-col gap-3 pt-2">
                <p className="text-sm text-accent/80">
                  {t('chat.enterInfo')}
                </p>
                <input
                  type="text"
                  placeholder={t('chat.yourName')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-[#1B2D4F] px-3 py-2 text-sm text-white placeholder:text-accent/50 focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <input
                  type="tel"
                  placeholder={t('chat.yourPhone')}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-[#1B2D4F] px-3 py-2 text-sm text-white placeholder:text-accent/50 focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-gradient-to-r from-accent-warm to-wood py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Bat dau tro chuyen
                </button>
              </form>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-center text-sm text-accent/60">
                  Hay gui tin nhan cho chung toi nhe!
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {messages.map((msg) => (
                  <ChatBubble key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input area (hidden when showing form) */}
          {!showForm && (
            <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border p-3">
              <input
                ref={inputRef}
                type="text"
                placeholder="Nhap tin nhan..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={sendState.sending}
                className="flex-1 rounded-lg border border-border bg-[#1B2D4F] px-3 py-2 text-sm text-white placeholder:text-accent/50 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={sendState.sending || !inputText.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-accent-warm to-wood text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                aria-label="Gui"
              >
                {sendState.sending ? (
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
          )}

          {/* Error message */}
          {sendState.error && (
            <div className="border-t border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {sendState.error}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// Re-exports for backward compatibility
export { ChatBubble } from './ChatBubble';
export type { ChatWidgetProps } from './ChatWidget-types';
export { LS_NAME_KEY, LS_PHONE_KEY } from './ChatWidget-constants';
export { useChatWidget } from './ChatWidget-hooks';
