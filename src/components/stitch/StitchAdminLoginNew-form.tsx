/**
 * StitchAdminLoginNew — Login Form sub-component
 *
 * Email/password form with validation, error display, and submit button.
 */

'use client';

import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import type { LoginStatus } from './StitchAdminLoginNew-types';

interface LoginFormProps {
  onLogin?: (email: string, password: string) => Promise<void>;
  status: LoginStatus;
  errorMessage: string;
  onStatusChange: (status: LoginStatus) => void;
  onErrorChange: (error: string) => void;
}

export function LoginForm({
  onLogin,
  status,
  errorMessage,
  onStatusChange,
  onErrorChange,
}: Readonly<LoginFormProps>) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      onErrorChange(t('adminLogin.validationRequired'));
      return;
    }
    onStatusChange('loading');
    onErrorChange('');
    try {
      if (onLogin) {
        await onLogin(email, password);
      } else {
        await new Promise((r) => setTimeout(r, 1500));
        onStatusChange('success');
      }
    } catch {
      onStatusChange('error');
      onErrorChange(t('adminLogin.loginFailed'));
    }
  };

  return (
    <form className="w-full space-y-6" onSubmit={handleSubmit} noValidate>
      {/* Email Field */}
      <div className="space-y-2">
        <label
          htmlFor="login-email-new"
          className="font-label-caps text-label-caps text-on-surface-variant px-1"
        >
          {t('adminLogin.credentials')}
        </label>
        <div className="relative">
          <input
            id="login-email-new"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('adminLogin.operatorEmail')}
            required
            aria-required="true"
            aria-label={t('adminLogin.emailAriaLabel')}
            className="w-full bg-[#050D17] border-0 border-b-[0.5px] border-white/20 text-on-surface px-4 py-4 font-body-sm tracking-widest placeholder:text-outline/40 transition-all focus:border-primary focus:outline-none focus:shadow-input"
          />
        </div>
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <div className="flex justify-between items-center px-1">
          <label
            htmlFor="login-password-new"
            className="font-label-caps text-label-caps text-on-surface-variant"
          >
            {t('adminLogin.securityKey')}
          </label>
        </div>
        <div className="relative group">
          <input
            id="login-password-new"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            required
            aria-required="true"
            aria-label={t('adminLogin.passwordAriaLabel')}
            className="w-full bg-[#050D17] border-0 border-b-[0.5px] border-white/20 text-on-surface px-4 py-4 font-body-sm tracking-widest placeholder:text-outline/40 transition-all focus:border-primary focus:outline-none focus:shadow-input pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
            tabIndex={-1}
            aria-label={
              showPassword
                ? t('adminLogin.hidePasswordAriaLabel')
                : t('adminLogin.showPasswordAriaLabel')
            }
          >
            {showPassword ? (
              <EyeOff className="w-[18px] h-[18px]" aria-hidden="true" />
            ) : (
              <Eye className="w-[18px] h-[18px]" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Inline Error Message */}
      {errorMessage && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--aura-error) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--aura-error) 15%, transparent)',
          }}
          role="alert"
        >
          <ShieldAlert className="w-4 h-4 text-[var(--aura-error)] shrink-0" aria-hidden="true" />
          <span className="font-body-sm text-[14px] text-[var(--aura-error)]">
            {errorMessage}
          </span>
        </div>
      )}

      {/* Action Button */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={status === 'loading'}
          className={'w-full chrome-gradient-bg py-4 rounded-lg text-[var(--aura-surface-container)] font-headline-md uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-primary/5 flex items-center justify-center gap-2'}
          aria-label={t('adminLogin.submitAriaLabel')}
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              {t('adminLogin.authorizing')}
            </>
          ) : status === 'success' ? (
            t('adminLogin.authorized')
          ) : (
            t('adminLogin.initializeSession')
          )}
        </button>
      </div>
    </form>
  );
}
