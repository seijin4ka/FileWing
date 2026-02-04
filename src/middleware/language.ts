/**
 * 言語検出ミドルウェア
 * Cookie、クエリパラメータ、Accept-Languageヘッダーから言語を検出
 */

import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  detectLanguageFromHeader,
  getLanguageFromCookie,
  createLanguageCookie,
  type Language,
} from '../i18n';

/**
 * 言語検出ミドルウェア
 * 優先順位: クエリパラメータ > Cookie > Accept-Languageヘッダー > デフォルト
 */
export const languageMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  let lang: Language = DEFAULT_LANGUAGE;

  // 1. クエリパラメータから言語を取得（最優先）
  const queryLang = c.req.query('lang');
  if (queryLang && SUPPORTED_LANGUAGES.includes(queryLang as Language)) {
    lang = queryLang as Language;
    // Cookieに保存
    c.header('Set-Cookie', createLanguageCookie(lang));
  } else {
    // 2. Cookieから言語を取得
    const cookieLang = getLanguageFromCookie(c.req.header('Cookie') ?? null);
    if (cookieLang) {
      lang = cookieLang;
    } else {
      // 3. Accept-Languageヘッダーから言語を取得
      lang = detectLanguageFromHeader(c.req.header('Accept-Language') ?? null);
    }
  }

  // コンテキストに言語を設定
  c.set('lang', lang);

  await next();
});

/**
 * 言語切り替えAPIハンドラ
 * GET /api/language/:lang
 */
export async function switchLanguage(lang: string): Promise<Response> {
  if (!SUPPORTED_LANGUAGES.includes(lang as Language)) {
    return new Response(JSON.stringify({ success: false, error: 'Unsupported language' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, lang }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': createLanguageCookie(lang as Language),
    },
  });
}
