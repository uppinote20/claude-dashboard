/**
 * Internationalization - language detection and translation loading
 * @handbook 5.4-i18n-structure
 */
import type { Translations, Config } from '../types.js';

// Import locale files
import en from '../../locales/en.json';
import ko from '../../locales/ko.json';

const LOCALES: Record<string, Translations> = {
  en: en as Translations,
  ko: ko as Translations,
};

/**
 * Detect system language from LANG environment variable
 *
 * @returns 'en' or 'ko'
 */
export function detectSystemLanguage(): 'en' | 'ko' {
  const lang = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || '';

  // Check for Korean
  if (lang.toLowerCase().startsWith('ko')) {
    return 'ko';
  }

  // Default to English
  return 'en';
}

/**
 * Get translations based on config
 *
 * @param config - User configuration
 * @returns Translations object
 */
export function getTranslations(config: Config): Translations {
  let lang: 'en' | 'ko';

  if (config.language === 'auto') {
    lang = detectSystemLanguage();
  } else {
    lang = config.language;
  }

  return LOCALES[lang] || LOCALES.en;
}

/**
 * Get translations by language code
 */
export function getTranslationsByLang(lang: 'en' | 'ko'): Translations {
  return LOCALES[lang] || LOCALES.en;
}
