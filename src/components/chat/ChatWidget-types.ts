import type { ChatMessage } from '@/hooks/use-chat';

export interface ChatWidgetProps {
  baseUrl?: string;
}

export interface ChatBubbleProps {
  message: ChatMessage;
}
