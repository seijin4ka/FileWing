/**
 * 管理者登録ページ
 * ローカル認証（AUTH_METHOD='local'）で、管理者が未登録のときに表示する
 * 公開URLにアクセスした管理者がその場でアカウントを作成する
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';
import { createTranslator, DEFAULT_LANGUAGE } from '../../i18n';
import { escapeHtml } from '../../templates/layout';
import { hasAdminUser } from '../../services/d1';

const register = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /register
 * 管理者登録ページ表示
 */
register.get('/', async (c) => {
  const lang = c.get('lang') || DEFAULT_LANGUAGE;
  const { get } = createTranslator(lang);

  // 既に管理者が登録されている場合は登録を受け付けない
  if (await hasAdminUser(c.env.DB)) {
    return c.redirect('/login', 302);
  }

  // エラーメッセージ
  const errorParam = c.req.query('error');
  let errorMessage = '';
  if (errorParam) {
    const errorMessages: Record<string, string> = {
      email: lang === 'ja' ? 'メールアドレスの形式が正しくありません。' : 'Invalid email address format.',
      password: lang === 'ja' ? 'パスワードは12文字以上で入力してください。' : 'Password must be at least 12 characters.',
      mismatch: lang === 'ja' ? 'パスワードが一致しません。' : 'Passwords do not match.',
      required: lang === 'ja' ? '必須項目が入力されていません。' : 'Required fields are missing.',
    };
    errorMessage = errorMessages[errorParam] || (lang === 'ja' ? '不明なエラーが発生しました。' : 'An unknown error occurred.');
  }

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${get('register.title')} - ${get('common.appName')}</title>
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
      <p class="mt-2 text-gray-600">${get('register.description')}</p>
    </div>

    <!-- 登録カード -->
    <div class="bg-white rounded-2xl shadow-xl p-8">
      <p class="text-sm text-gray-600 mb-4">${get('register.lead')}</p>

      <div class="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div class="flex items-start">
          <svg class="w-5 h-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-2.99l-6.93-12a2 2 0 00-3.48 0l-6.93 12A2 2 0 005.07 19z"/>
          </svg>
          <span class="text-sm text-amber-800">${get('register.warning')}</span>
        </div>
      </div>

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

      <form method="POST" action="/auth/register" class="space-y-4">
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 mb-1">${get('register.name')}</label>
          <input type="text" id="name" name="name" autocomplete="name"
                 class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
        </div>

        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">${get('register.email')}</label>
          <input type="email" id="email" name="email" required autocomplete="username"
                 class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-1">${get('register.password')}</label>
          <input type="password" id="password" name="password" required minlength="12" autocomplete="new-password"
                 class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
          <p class="mt-1 text-xs text-gray-500">${get('register.passwordHint')}</p>
        </div>

        <div>
          <label for="password_confirm" class="block text-sm font-medium text-gray-700 mb-1">${get('register.passwordConfirm')}</label>
          <input type="password" id="password_confirm" name="password_confirm" required minlength="12" autocomplete="new-password"
                 class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
        </div>

        <button type="submit"
                class="w-full flex items-center justify-center px-6 py-3 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors shadow-md hover:shadow-lg">
          ${get('register.submit')}
        </button>
      </form>

      <div class="mt-6 text-center">
        <p class="text-xs text-gray-500">${get('register.footer')}</p>
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

export default register;
