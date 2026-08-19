import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useChat } from '@/hooks/use-chat';
import { LS_NAME_KEY, LS_PHONE_KEY } from './ChatWidget-constants';

export function useChatWidget() {
  const { t } = useTranslation();
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
  const lastCountedMsgId = useRef<number | null>(null);

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

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isOpen]);

  // Simulate "admin replied" badge count — only count each message once
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && last.direction === 'admin' && !isOpen && last.id !== lastCountedMsgId.current) {
      lastCountedMsgId.current = last.id;
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

  return {
    t,
    isOpen,
    setIsOpen,
    name,
    setName,
    phone,
    setPhone,
    showForm,
    inputText,
    setInputText,
    unreadCount,
    messages,
    sendState,
    messagesEndRef,
    panelRef,
    inputRef,
    handleSaveInfo,
    handleSend,
    handleToggle,
  };
}
