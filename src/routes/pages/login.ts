/**
 * ログインページ
 * SAML SSO認証、またはローカル認証（メールアドレス+パスワード）のログインUI
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';
import { createTranslator, DEFAULT_LANGUAGE } from '../../i18n';
import { escapeHtml } from '../../templates/layout';
import { resolveAuthMethod } from '../../middleware/auth';
import { hasAdminUser } from '../../services/d1';

const login = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /login
 * ログインページ表示
 */
login.get('/', async (c) => {
  const lang = c.get('lang') || DEFAULT_LANGUAGE;
  const { get } = createTranslator(lang);

  const authMethod = await resolveAuthMethod(c.env, c.env.DB);
  const isLocalAuth = authMethod === 'local';

  // 認証方式が未設定の場合は初期セットアップ画面へ
  if (authMethod === 'setup') {
    return c.redirect('/setup', 302);
  }

  // ローカル認証で管理者が未登録の場合は、まず管理者登録を行う
  if (isLocalAuth && !(await hasAdminUser(c.env.DB))) {
    return c.redirect('/register', 302);
  }

  // エラーメッセージ
  const errorParam = c.req.query('error');
  let errorMessage = '';
  if (errorParam) {
    const errorMessages: Record<string, string> = {
      config: lang === 'ja' ? 'SAML設定が不完全です。管理者に連絡してください。' : 'SAML configuration is incomplete. Please contact administrator.',
      response: lang === 'ja' ? 'SAMLレスポンスが不正です。' : 'Invalid SAML response.',
      validation: lang === 'ja' ? '認証に失敗しました。' : 'Authentication failed.',
      email: lang === 'ja' ? 'メールアドレスを取得できませんでした。' : 'Failed to retrieve email address.',
      domain: lang === 'ja' ? 'このドメインからのログインは許可されていません。' : 'Login from this domain is not allowed.',
      session: lang === 'ja' ? 'セッションが無効です。再度ログインしてください。' : 'Session is invalid. Please login again.',
      credentials: lang === 'ja' ? 'メールアドレスまたはパスワードが正しくありません。' : 'Incorrect email address or password.',
      ratelimit: lang === 'ja' ? '試行回数が上限に達しました。しばらく時間をおいて再度お試しください。' : 'Too many attempts. Please try again later.',
    };
    errorMessage = errorMessages[errorParam] || (lang === 'ja' ? '不明なエラーが発生しました。' : 'An unknown error occurred.');
  }

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${get('login.title')} - ${get('common.appName')}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: {
              50: '#fff7ed',
              100: '#ffedd5',
              200: '#fed7aa',
              300: '#fdba74',
              400: '#fb923c',
              500: '#f6821f',
              600: '#ea580c',
              700: '#c2410c',
              800: '#9a3412',
              900: '#7c2d12',
            }
          }
        }
      }
    }
  </script>
</head>
<body class="bg-gradient-to-br from-primary-50 to-orange-100 min-h-screen flex items-center justify-center p-4">
  <div class="max-w-md w-full">
    <!-- ロゴ・タイトル -->
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-2xl shadow-lg mb-4">
        <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
        </svg>
      </div>
      <h1 class="text-3xl font-bold text-gray-900">${get('common.appName')}</h1>
      <p class="mt-2 text-gray-600">${get('login.description')}</p>
    </div>

    <!-- ログインカード -->
    <div class="bg-white rounded-2xl shadow-xl p-8">
      ${errorMessage ? `
      <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span class="text-sm text-red-700">${escapeHtml(errorMessage)}</span>
        </div>
      </div>
      ` : ''}

      ${isLocalAuth ? `
      <form method="POST" action="/auth/local/login" class="space-y-4">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">${get('login.email')}</label>
          <input type="email" id="email" name="email" required autocomplete="username"
                 class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-1">${get('login.password')}</label>
          <input type="password" id="password" name="password" required autocomplete="current-password"
                 class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
        </div>

        <button type="submit"
                class="w-full flex items-center justify-center px-6 py-3 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors shadow-md hover:shadow-lg">
          ${get('login.submit')}
        </button>
      </form>
      ` : `
      <a href="/auth/login" class="w-full flex items-center justify-center px-6 py-3 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors shadow-md hover:shadow-lg">
        <svg class="w-6 h-6 mr-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        ${get('login.googleLogin')}
      </a>
      `}

      <div class="mt-6 text-center">
        <p class="text-xs text-gray-500">${isLocalAuth ? get('login.localSecurityNote') : get('login.securityNote')}</p>
      </div>
    </div>

    <!-- フッター -->
    <div class="mt-8 text-center text-sm text-gray-500">
      <p>${get('login.footer')}</p>
    </div>
  </div>
</body>
</html>`;

  return c.html(html);
});

export default login;
