import type { ChatBubbleProps } from './ChatWidget-types';

export function ChatBubble({ message }: ChatBubbleProps) {
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
