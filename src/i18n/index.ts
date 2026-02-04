/**
 * 多言語対応 - i18nユーティリティ
 */

import { translations, type Language, type TranslationKeys } from './translations';

export { translations, type Language, type TranslationKeys };

/**
 * デフォルト言語
 */
export const DEFAULT_LANGUAGE: Language = 'ja';

/**
 * サポートされている言語
 */
export const SUPPORTED_LANGUAGES: Language[] = ['ja', 'en'];

/**
 * 言語名の表示
 */
export const LANGUAGE_NAMES: Record<Language, string> = {
  ja: '日本語',
  en: 'English',
};

/**
 * Accept-Languageヘッダーから言語を検出
 */
export function detectLanguageFromHeader(acceptLanguage: string | null): Language {
  if (!acceptLanguage) return DEFAULT_LANGUAGE;

  const languages = acceptLanguage.split(',').map((lang) => {
    const [code, qValue] = lang.trim().split(';q=');
    return {
      code: code.split('-')[0].toLowerCase(),
      q: qValue ? parseFloat(qValue) : 1,
    };
  });

  languages.sort((a, b) => b.q - a.q);

  for (const lang of languages) {
    if (SUPPORTED_LANGUAGES.includes(lang.code as Language)) {
      return lang.code as Language;
    }
  }

  return DEFAULT_LANGUAGE;
}

/**
 * Cookieから言語を取得
 */
export function getLanguageFromCookie(cookieHeader: string | null): Language | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').reduce(
    (acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    },
    {} as Record<string, string>
  );

  const lang = cookies['lang'];
  if (lang && SUPPORTED_LANGUAGES.includes(lang as Language)) {
    return lang as Language;
  }

  return null;
}

/**
 * 翻訳を取得するヘルパー関数を作成
 */
export function createTranslator(lang: Language) {
  const t = translations[lang];

  /**
   * ドット区切りのキーで翻訳を取得
   * 例: get('common.loading') => '読み込み中...'
   */
  function get(key: string): string {
    const keys = key.split('.');
    let result: unknown = t;

    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = (result as Record<string, unknown>)[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    if (typeof result === 'string') {
      return result;
    }

    console.warn(`Translation value is not a string: ${key}`);
    return key;
  }

  return { t, get, lang };
}

/**
 * 言語切り替え用Cookie設定ヘッダーを生成
 */
export function createLanguageCookie(lang: Language): string {
  // 1年間有効
  const maxAge = 60 * 60 * 24 * 365;
  return `lang=${lang}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}
