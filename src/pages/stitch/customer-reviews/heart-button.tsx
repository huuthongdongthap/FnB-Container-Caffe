import { useState } from 'react';

export function HeartButton({ likes }: { likes: number }) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(likes);

  const toggle = () => {
    setLiked((prev) => !prev);
    setCount((prev) => (liked ? prev - 1 : prev + 1));
  };

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1 transition-colors ${liked ? 'text-red-400' : 'text-[var(--aura-chrome-dark)]/60 hover:text-red-400'}`}
    >
      <span className="text-lg">{liked ? '❤️' : '🤍'}</span>
      <span className="font-body text-xs">{count}</span>
    </button>
  );
}
