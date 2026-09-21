'use client';

import '@/i18n/config';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { useEffect } from 'react';

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Sync <html lang=""> and dir with current language on mount + change
    const updateHtmlLang = (lng: string) => {
      const dirMap: Record<string, string> = { ar: 'rtl' };
      document.documentElement.lang = lng;
      document.documentElement.dir = dirMap[lng] || 'ltr';
    };

    updateHtmlLang(i18n.language);
    i18n.on('languageChanged', updateHtmlLang);
    return () => { i18n.off('languageChanged', updateHtmlLang); };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
