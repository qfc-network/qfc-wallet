import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Language, Translations } from './types';
import { translations } from './locales';

const STORAGE_KEY = 'qfc_language';
const DEFAULT_LANGUAGE: Language = 'en';

interface I18nContextValue {
  language: Language;
  t: Translations;
  setLanguage: (lang: Language) => Promise<void>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load language preference from storage on mount
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        const storedLang = result[STORAGE_KEY] as Language | undefined;
        if (storedLang && translations[storedLang]) {
          setLanguageState(storedLang);
        } else {
          // Try to detect browser language
          const browserLang = navigator.language.split('-')[0] as Language;
          if (translations[browserLang]) {
            setLanguageState(browserLang);
          }
        }
      } catch (error) {
        console.error('Failed to load language preference:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadLanguage();
  }, []);

  const setLanguage = async (lang: Language) => {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: lang });
      setLanguageState(lang);
    } catch (error) {
      console.error('Failed to save language preference:', error);
    }
  };

  // Get translations for current language
  const t = translations[language];

  // Don't render until language is loaded to prevent flash
  if (!isLoaded) {
    return null;
  }

  return (
    <I18nContext.Provider value={{ language, t, setLanguage }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// Shorthand hook for just translations
export function useTranslation() {
  const { t } = useI18n();
  return t;
}
