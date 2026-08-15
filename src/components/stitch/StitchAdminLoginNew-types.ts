/**
 * StitchAdminLoginNew — Types
 */

export type LoginStatus = 'idle' | 'loading' | 'error' | 'success';

export interface StitchAdminLoginNewProps {
  /** External login handler. Falls back to simulated delay if omitted. */
  onLogin?: (email: string, password: string) => Promise<void>;
  /** External control of login status (loading, error, etc.). */
  status?: LoginStatus;
  /** Error message shown in the error state. */
  errorMessage?: string;
  /** Brand name displayed in the header and logo. */
  brandName?: string;
}
