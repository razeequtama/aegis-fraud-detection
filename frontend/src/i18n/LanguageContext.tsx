import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { Language, LanguageContextType, Translations } from './types';
import { en } from './translations/en';
import { id } from './translations/id';

const STORAGE_KEY = 'aegis_language';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export interface LanguageProviderProps {
  children: React.ReactNode;
  defaultLanguage?: Language;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  children,
  defaultLanguage = 'en',
}) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'id') {
        return stored;
      }
    } catch {
      // Ignore localStorage read errors (e.g. incognito mode)
    }
    return defaultLanguage;
  });

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch {
      // Ignore localStorage write errors
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t: Translations = useMemo(() => {
    return language === 'id' ? id : en;
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      language: 'en',
      setLanguage: () => {},
      t: en,
    };
  }
  return context;
};

export const useTranslation = (): { t: Translations; language: Language; setLanguage: (lang: Language) => void } => {
  return useLanguage();
};

