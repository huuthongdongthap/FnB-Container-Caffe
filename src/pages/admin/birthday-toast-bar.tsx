export type ToastKind = 'success' | 'error';

export function ToastBar({
  kind,
  message,
  onDismiss,
}: {
  kind: ToastKind;
  message: string;
  onDismiss: () => void;
}) {
  const bg = kind === 'success' ? 'bg-green-700' : 'bg-red-700';
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3 shadow-2xl ${bg} text-white text-sm font-medium animate-slide-up`}
      role="alert"
    >
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-2 text-white/70 hover:text-white transition-colors" aria-label="Dismiss">
        &times;
      </button>
    </div>
  );
}
