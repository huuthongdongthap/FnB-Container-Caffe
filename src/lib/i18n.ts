import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import viRaw from '../locales/vi.json';
import enRaw from '../locales/en.json';

// Build namespace resources from locale data
// 1. Promote nested objects (e.g. contact: { seoTitle }) to namespaces
// 2. Also handle flat keys with dots (e.g. 'checkout.luxuryTax')
function buildNamespaces(data: Record<string, unknown>) {
  const namespaces: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Nested object → merge into namespace to preserve flat entries
      namespaces[key] = {
        ...(namespaces[key] || {}),
        ...(value as Record<string, unknown>),
      };
      // Promote known admin sub-objects (e.g. dindin, tableManagement) to namespaces
      if (key === 'admin') {
        const adminObj = value as Record<string, unknown>;
        for (const [subKey, subVal] of Object.entries(adminObj)) {
          if (typeof subVal === 'object' && subVal !== null && !Array.isArray(subVal)) {
            namespaces[subKey] = {
              ...(namespaces[subKey] || {}),
              ...(subVal as Record<string, unknown>),
            };
          }
        }
      }
    } else if (typeof value === 'string') {
      // Flat key with dot → extract as namespace entry
      const dot = key.indexOf('.');
      if (dot > 0) {
        const ns = key.slice(0, dot);
        const k = key.slice(dot + 1);
        if (!namespaces[ns]) namespaces[ns] = {};
        namespaces[ns][k] = value;
      }
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
