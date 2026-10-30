/**
 * Ambient declaration for `web-push`.
 *
 * The package ships no bundled types and the upstream `@types/web-push` lags behind
 * web-push 3.x, so the worker pins a minimal surface covering only what it uses.
 */

declare module 'web-push' {
  interface PushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  export interface WebPushError extends Error {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }

  const webpush: {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(
      subscription: PushSubscription,
      payload?: string | null,
      options?: Record<string, unknown>,
    ): Promise<{ statusCode: number; body: string; headers: Record<string, string> }>;
  };

  export default webpush;
}
