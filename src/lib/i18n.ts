import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import vi from '../../public/locales/vi/translation.json';
import en from '../../public/locales/en/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'vi',
    debug: false,
    interpolation: { escapeValue: false },
    resources: {
      vi: { translation: vi },
      en: { translation: en },
    },
  });

export default i18n;
