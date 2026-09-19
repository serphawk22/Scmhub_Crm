'use client';

import { useEffect } from 'react';


import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, SupportedLocale } from '@/i18n/config';
import { cn } from '@/lib/utils';
import { useLanguage, Language } from '@/context/LanguageContext';

interface LanguageSelectorProps {
  className?: string;
}

export default function LanguageSelector({ className }: LanguageSelectorProps = {}) {
  const { t, i18n } = useTranslation();
  const { setLanguage } = useLanguage();

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];
  // Limit to English and Spanish only
  const displayedLanguages = SUPPORTED_LANGUAGES.filter(l => l.code === 'en' || l.code === 'es');

  // Synchronize language from localStorage on mount (default is English)
  useEffect(() => {
    const savedLang = localStorage.getItem('crm-language') || localStorage.getItem('language');
    if (savedLang && ['en', 'es'].includes(savedLang) && i18n.language !== savedLang) {
      i18n.changeLanguage(savedLang);
      setLanguage(savedLang as Language);
    }
  }, []);

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('crm-language', code);
    localStorage.setItem('language', code);
    setLanguage(code as Language);
    // Optionally trigger Google Translate if present – retained unchanged
    const triggerGoogleTranslate = (lang: string, attempts = 0) => {
      if (lang === 'en') {
        sessionStorage.setItem('crm_gt_restore_en', '1');
        document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
        document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname}`;
        window.location.reload();
        return;
      }
      document.cookie = `googtrans=/en/${lang}; path=/;`;
      document.cookie = `googtrans=/en/${lang}; path=/; domain=${window.location.hostname}`;
      document.cookie = `googtrans=/en/${lang}; path=/; domain=.${window.location.hostname}`;
      document.documentElement.classList.remove('notranslate');
      document.documentElement.removeAttribute('translate');
      const select = document.querySelector<HTMLSelectElement>('.goog-te-combo');
      if (select) {
        select.value = lang;
        select.dispatchEvent(new Event('change'));
      } else if (attempts < 25) {

        setTimeout(() => triggerGoogleTranslate(lang, attempts + 1), 100);
      }
    };
    triggerGoogleTranslate(code);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {displayedLanguages.map((lang) => {
        const isActive = lang.code === currentLang.code;
        return (
          <button
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all",
              isActive
                ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300"
                : "bg-white border-transparent text-slate-600 hover:bg-slate-50 dark:bg-zinc-950 dark:text-zinc-300 hover:border-slate-200 dark:border-zinc-700"
            )}
          >
            <span className="uppercase text-[11px] font-black tracking-widest whitespace-nowrap">
              {lang.code === 'en' ? 'US EN' : 'ES ES'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
