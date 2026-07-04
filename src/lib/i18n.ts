import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import viRaw from '../locales/vi.json';
import enRaw from '../locales/en.json';

// Build namespace resources from flat keys
// Keys like 'checkout.luxuryTax' → namespace 'checkout', key 'luxuryTax'
function buildNamespaces(flat: Record<string, unknown>) {
  const namespaces: Record<string, Record<string, string>> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (typeof value !== 'string') continue; // skip nested objects
    const dot = key.indexOf('.');
    if (dot > 0) {
      const ns = key.slice(0, dot);
      const k = key.slice(dot + 1);
      if (!namespaces[ns]) namespaces[ns] = {};
      namespaces[ns][k] = value;
    }
  }
  return namespaces;
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'vi',
    debug: false,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
    },
    resources: {
      vi: { translation: viRaw, ...buildNamespaces(viRaw) },
      en: { translation: enRaw, ...buildNamespaces(enRaw) },
    },
  });

export default i18n;
