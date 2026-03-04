import { createContext, useContext, useState, useEffect } from 'react';

const LANG_STORAGE_KEY = 'gp_lang';
const SUPPORTED_LANGS = ['en', 'ja', 'zh'];
const DEFAULT_LANG = 'en';

const LanguageContext = createContext({ lang: DEFAULT_LANG, setLang: () => {} });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      return SUPPORTED_LANGS.includes(stored) ? stored : DEFAULT_LANG;
    } catch {
      return DEFAULT_LANG;
    }
  });

  const setLang = (newLang) => {
    if (!SUPPORTED_LANGS.includes(newLang)) return;
    setLangState(newLang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, newLang);
    } catch {}
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
