'use client';

import { useEffect, type ReactNode } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TableOrder } from '@/pages/TableOrder';

const SUPPORTED_LOCALES = new Set(['vi', 'en']);

export function LocaleOrderPage(): ReactNode {
  const { locale } = useParams<{ locale: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();

  useEffect(() => {
    if (!locale) {
      const next = `/order${location.search}`;
      navigate(next, { replace: true });
      return;
    }
    if (SUPPORTED_LOCALES.has(locale) && i18n.resolvedLanguage !== locale) {
      void i18n.changeLanguage(locale).catch(() => { /* non-fatal */ });
    }
  }, [i18n, locale, location.search, navigate]);

  if (!locale || !SUPPORTED_LOCALES.has(locale)) {
    return null;
  }

  return <TableOrder />;
}

export default LocaleOrderPage;
