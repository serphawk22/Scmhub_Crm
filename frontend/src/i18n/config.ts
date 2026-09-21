import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// ─── Eager-import all locale bundles ─────────────────────────────────────────
// Each language namespace is split by domain for maintainability.
// Add new languages by dropping a folder under /locales and importing below.
import enCommon from '@/locales/en/common.json';
import esCommon from '@/locales/es/common.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English',  nativeName: 'English',  flag: '🇺🇸', dir: 'ltr' },
  { code: 'es', name: 'Spanish',  nativeName: 'Español',  flag: '🇪🇸', dir: 'ltr' },
  // Future: { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷', dir: 'ltr' },
  // Future: { code: 'ar', name: 'Arabic',     nativeName: 'عربي',      flag: '🇸🇦', dir: 'rtl' },
  // Future: { code: 'ja', name: 'Japanese',   nativeName: '日本語',    flag: '🇯🇵', dir: 'ltr' },
  // Future: { code: 'zh', name: 'Chinese',    nativeName: '中文',      flag: '🇨🇳', dir: 'ltr' },
] as const;

export type SupportedLocale = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const resources = {
  en: { common: enCommon },
  es: { common: esCommon },
};

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      defaultNS: 'common',
      fallbackLng: 'en',
      supportedLngs: ['en', 'es'],
      interpolation: {
        escapeValue: false, // React already escapes values
      },
      detection: {
        // Priority order for language detection
        order: ['localStorage'],
        lookupLocalStorage: 'crm-language',
        caches: ['localStorage'],
      },
      react: {
        useSuspense: false, // Prevent hydration mismatches in Next.js
      },
    });
}

export default i18n;

// ─── Enterprise date/number formatters ────────────────────────────────────────
export function formatDate(date: Date | string, locale: string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  const localeMap: Record<string, string> = {
    en: 'en-US', es: 'es-ES',
  };
  return d.toLocaleDateString(localeMap[locale] || 'en-US', options || {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export function formatDateShort(date: Date | string, locale: string): string {
  return formatDate(date, locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatCurrency(amount: number, locale: string, currency = 'USD'): string {
  const localeMap: Record<string, string> = {
    en: 'en-US', es: 'es-ES',
  };
  return new Intl.NumberFormat(localeMap[locale] || 'en-US', {
    style: 'currency', currency,
  }).format(amount);
}

export function formatNumber(value: number, locale: string): string {
  const localeMap: Record<string, string> = {
    en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT',
  };
  return new Intl.NumberFormat(localeMap[locale] || 'en-US').format(value);
}

export function formatRelativeTime(date: Date | string, locale: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  const localeMap: Record<string, string> = {
    en: 'en-US', es: 'es-ES',
  };
  const rtf = new Intl.RelativeTimeFormat(localeMap[locale] || 'en-US', { numeric: 'auto' });
  const diff = d.getTime() - Date.now();
  const absDiff = Math.abs(diff);
  if (absDiff < 60000) return rtf.format(Math.round(diff / 1000), 'second');
  if (absDiff < 3600000) return rtf.format(Math.round(diff / 60000), 'minute');
  if (absDiff < 86400000) return rtf.format(Math.round(diff / 3600000), 'hour');
  if (absDiff < 2592000000) return rtf.format(Math.round(diff / 86400000), 'day');
  if (absDiff < 31536000000) return rtf.format(Math.round(diff / 2592000000), 'month');
  return rtf.format(Math.round(diff / 31536000000), 'year');
}
