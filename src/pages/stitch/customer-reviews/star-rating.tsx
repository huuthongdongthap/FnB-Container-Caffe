export function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`text-sm ${i < rating ? 'text-[var(--aura-chrome-mid)]' : 'text-[var(--aura-chrome-dark)]/30'}`}>
          {i < rating ? '★' : '★'}
        </span>
      ))}
    </div>
  );
}
