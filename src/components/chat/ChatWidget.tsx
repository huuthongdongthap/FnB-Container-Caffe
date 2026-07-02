import { useState, useEffect, useRef, useCallback } from 'react';
import { useChat, type ChatMessage } from '@/hooks/use-chat';

const LS_NAME_KEY = 'aura_chat_name';
const LS_PHONE_KEY = 'aura_chat_phone';

interface ChatWidgetProps {
  baseUrl?: string;
}

export function ChatWidget({ baseUrl }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(() => localStorage.getItem(LS_NAME_KEY) || '');
  const [phone, setPhone] = useState(() => localStorage.getItem(LS_PHONE_KEY) || '');
  const [showForm, setShowForm] = useState(!name || !phone);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const { sendMessage, sendState, messages, fetchMessages } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && !showForm) {
      inputRef.current?.focus();
    }
  }, [isOpen, showForm]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const btn = document.querySelector('[data-chat-toggle]');
        if (btn && btn.contains(e.target as Node)) return;
        setIsOpen(false);
      }
    }

    // Delay to avoid immediate close from toggle click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isOpen]);

  // Simulate "admin replied" badge count if last message is from admin (in memory)
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && last.direction === 'admin' && !isOpen) {
      setUnreadCount((prev) => prev + 1);
    }
  }, [messages, isOpen]);

  // Reset unread when opening
  useEffect(() => {
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  const handleSaveInfo = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !phone.trim()) return;
      localStorage.setItem(LS_NAME_KEY, name.trim());
      localStorage.setItem(LS_PHONE_KEY, phone.trim());
      setShowForm(false);
    },
    [name, phone]
  );

  const handleSend = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputText.trim() || sendState.sending) return;
      sendMessage(name, phone, inputText.trim());
      setInputText('');
    },
    [inputText, sendState.sending, sendMessage, name, phone]
  );

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

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
          className="fixed bottom-24 right-6 z-50 flex w-[350px] max-h-[500px] flex-col rounded-2xl border border-border bg-[#0A1628] shadow-2xl"
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
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
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
              /* Name + Phone form */
              <form onSubmit={handleSaveInfo} className="flex flex-col gap-3 pt-2">
                <p className="text-sm text-accent/80">
                  Nhap thong tin cua ban de bat dau tro chuyen
                </p>
                <input
                  type="text"
                  placeholder="Ten cua ban"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-[#1B2D4F] px-3 py-2 text-sm text-white placeholder:text-accent/50 focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <input
                  type="tel"
                  placeholder="So dien thoai"
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
              /* Empty state */
              <div className="flex h-full items-center justify-center">
                <p className="text-center text-sm text-accent/60">
                  Hay gui tin nhan cho chung toi nhe!
                </p>
              </div>
            ) : (
              /* Messages list */
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

function ChatBubble({ message }: { message: ChatMessage }) {
  const isCustomer = message.direction === 'customer';
  const time = new Date(message.created_at).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
          isCustomer
            ? 'rounded-br-md bg-blue-500 text-white'
            : 'rounded-bl-md bg-[#2D5A3D] text-white'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.message}</p>
        <p
          className={`mt-1 text-[10px] ${
            isCustomer ? 'text-blue-200' : 'text-green-200'
          }`}
        >
          {time}
        </p>
      </div>
    </div>
  );
}
