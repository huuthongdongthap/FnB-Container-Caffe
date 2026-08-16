/**
 * Simple toast notification system.
 * Auto-dismiss after 2.5s. Stack up to 3 toasts.
 */
import { useEffect, useState, useCallback, createContext, useContext } from 'react';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextValue {
  showToast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++toastId;
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg
              backdrop-blur-md border animate-[slideIn_0.2s_ease-out]
              ${t.type === 'success' ? 'bg-[var(--aura-forest-deep)]/90 border-[var(--aura-forest-primary)] text-[var(--aura-forest-pale)]' : ''}
              ${t.type === 'error' ? 'bg-red-900/90 border-red-600 text-red-200' : ''}
              ${t.type === 'info' ? 'bg-[var(--aura-noir-deep)]/90 border-[var(--aura-border-chrome)] text-[var(--aura-chrome-light)]' : ''}
            `}
          >
            {t.type === 'success' && '✓ '}
            {t.type === 'error' && '✕ '}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
