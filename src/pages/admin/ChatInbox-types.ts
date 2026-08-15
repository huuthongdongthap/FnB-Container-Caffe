import type { ChatMessage } from '@/hooks/use-chat';

export type ViewState = 'list' | 'detail';

export interface ChatDetailViewProps {
  phone: string;
  name: string;
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  onBack: () => void;
}
