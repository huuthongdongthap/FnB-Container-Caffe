/**
 * StitchContactNew — Contact form card section
 */
'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { glassPanelClasses } from './StitchContactNew-constants';
import { FormField } from './StitchContactNew-form-field';

export function ContactFormCard({
  onSubmit,
  isSubmitting,
}: {
  onSubmit?: (data: { name: string; email: string; message: string }) => void;
  isSubmitting?: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (name && email && message) {
        onSubmit?.({ name, email, message });
      }
    },
    [name, email, message, onSubmit],
  );

  return (
    <div
      className={cn(glassPanelClasses, 'md:col-span-7 p-6')}
      style={{ boxShadow: '0 0 20px 0 rgba(212, 165, 116, 0.15)' }}
    >
      <h2 className="text-[24px] font-bold leading-tight font-['EB_Garamond'] text-[var(--aura-chrome-bright)] mb-6">
        {t('contact.formTitle', 'Send a Message')}
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <FormField
          label={t('contact.formName', 'NAME')}
          placeholder="John Doe"
          value={name}
          onChange={setName}
        />
        <FormField
          label={t('contact.formEmail', 'EMAIL')}
          placeholder="john@example.com"
          type="email"
          value={email}
          onChange={setEmail}
        />
        <FormField
          label={t('contact.formMessage', 'MESSAGE')}
          placeholder={t('contact.formMessagePlaceholder', 'Your enquiry here...')}
          value={message}
          onChange={setMessage}
          multiline
        />

        <button
          type="submit"
          disabled={isSubmitting || !name || !email || !message}
          className="mt-4 bg-[var(--aura-bronze-shimmer)] text-white py-4 px-8 font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              {t('contact.submit', 'DISPATCH MESSAGE')}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
