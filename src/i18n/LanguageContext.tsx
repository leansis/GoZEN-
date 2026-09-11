import React, { createContext, useContext, useState, useEffect } from 'react';
import { es } from './translations/es';
import { de } from './translations/de';
import { es as dateFnsEs, de as dateFnsDe } from 'date-fns/locale';

export type Language = 'es' | 'de';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallbackOrParams?: string | Record<string, any>, params?: Record<string, any>) => string;
  dateLocale: typeof dateFnsEs;
}

const translations: Record<Language, any> = { es, de };

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'gozen_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'es' || saved === 'de') return saved;
      // Auto-detect browser language if German
      if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de')) {
        return 'de';
      }
    } catch (e) {
      console.warn('Could not read language from localStorage:', e);
    }
    return 'es';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch (e) {
      console.warn('Could not save language to localStorage:', e);
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string, fallbackOrParams?: string | Record<string, any>, params?: Record<string, any>): string => {
    let fallback: string | undefined;
    let interpolations: Record<string, any> | undefined;

    if (typeof fallbackOrParams === 'string') {
      fallback = fallbackOrParams;
      interpolations = params;
    } else if (typeof fallbackOrParams === 'object' && fallbackOrParams !== null) {
      interpolations = fallbackOrParams;
    }

    const getNestedValue = (obj: any, path: string): any => {
      if (!obj) return undefined;
      const parts = path.split('.');
      let current = obj;
      for (const part of parts) {
        if (current === undefined || current === null) return undefined;
        current = current[part];
      }
      return current;
    };

    // 1. Try current language
    let result = getNestedValue(translations[language], key);

    // 2. Fallback to Spanish if missing in current language
    if (result === undefined && language !== 'es') {
      result = getNestedValue(translations.es, key);
    }

    // 3. Fallback to passed fallback string or key itself
    if (result === undefined) {
      result = fallback !== undefined ? fallback : key.split('.').pop() || key;
    }

    // 4. Handle interpolation if string
    if (typeof result === 'string' && interpolations) {
      return Object.entries(interpolations).reduce((acc, [k, v]) => {
        return acc.replace(new RegExp(`{${k}}`, 'g'), String(v));
      }, result);
    }

    return typeof result === 'string' ? result : String(result ?? key);
  };

  const dateLocale = language === 'de' ? dateFnsDe : dateFnsEs;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dateLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
