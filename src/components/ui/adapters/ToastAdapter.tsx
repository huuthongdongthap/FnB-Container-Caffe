import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { MD3Snackbar } from '@/components/md3/md3-snackbar';

/**
 * ToastAdapter — backward-compatible toast notification provider.
 * Wraps MD3Snackbar while preserving the useToast() hook API.
 */
export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextValue {
  showToast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const latestToast = toasts[toasts.length - 1];

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {latestToast && (
        <MD3Snackbar
          open={true}
          message={latestToast.message}
          onClose={() => removeToast(latestToast.id)}
          duration={2500}
        />
      )}
    </ToastContext.Provider>
  );
}