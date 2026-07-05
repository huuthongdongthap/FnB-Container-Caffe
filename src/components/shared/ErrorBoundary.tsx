import { Component, type ReactNode, type ErrorInfo } from 'react';
import { logger } from '@/lib/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console in development
    if (import.meta.env.DEV) {
      logger.error('[ErrorBoundary] Uncaught error:', { message: error.message, componentStack: errorInfo.componentStack });
    }

    // Report to analytics endpoint
    try {
      const body = JSON.stringify({
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/errors', body);
      } else {
        fetch('/api/errors', { method: 'POST', body, keepalive: true }).catch(() => {});
      }
    } catch {
      // Silently fail — do not re-enter error state from reporting
    }

    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 text-center"
        >
          <div className="mb-2 text-2xl" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-[#CD7F32]">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 className="font-display text-lg font-semibold text-[#e4e2e4]">
            Something went wrong / Đã xảy ra lỗi
          </h3>
          <p className="mt-1 text-sm text-[#b8c7e2]">
            Please try refreshing the page. / Vui lòng làm mới trang.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full bg-[#CD7F32] px-6 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95"
          >
            Refresh / Làm mới
          </button>
          {import.meta.env.DEV && this.state.error && (
            <details className="mt-4 w-full max-w-md text-left">
              <summary className="cursor-pointer text-xs text-[#b8c7e2]">Error details</summary>
              <pre className="mt-2 overflow-auto rounded bg-black/30 p-3 text-xs text-red-300">
                {this.state.error.message}
                {'\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
