"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "en" | "es";

interface LanguageContextType {
  language: Language;
  activeLang?: Language;
  setLanguage: (lang: Language | string) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Import translations
import en from "@/translations/en.json";
import es from "@/translations/es.json";

const translations = {
  en,
  es,
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const savedLanguage = localStorage.getItem("language") || localStorage.getItem("crm-language") as Language | null;
    if (savedLanguage && ["en", "es"].includes(savedLanguage)) {
      setLanguageState(savedLanguage as Language);
    }
  }, []);

  const setLanguage = (lang: Language | string) => {
    const validLang = ["en", "es"].includes(lang) ? (lang as Language) : "en";
    setLanguageState(validLang);
    localStorage.setItem("language", validLang);
    localStorage.setItem("crm-language", validLang); // Keep both in sync
  };

  const t = (key: string): string => {
    const keys = key.split(".");
    let value: any = translations[language];

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    return typeof value === "string" ? value : key;
  };

  return (
    <LanguageContext.Provider value={{ language, activeLang: language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
