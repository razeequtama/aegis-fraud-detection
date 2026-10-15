export type Language = 'en' | 'id';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

export type Translations = typeof import('./translations/en').en;

