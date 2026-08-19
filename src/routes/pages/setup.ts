/**
 * 初期セットアップページ
 *
 * 認証方式が未設定のときに表示し、
 * 「管理者アカウントを作成（ローカル認証）」か
 * 「SAML SSOを設定」かを選択させる。
 *
 * 環境変数を触らずに画面から設定できるため、
 * Deploy to Cloudflareボタン経由のデプロイだけで運用できる。
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';
import { createTranslator, DEFAULT_LANGUAGE, type Language } from '../../i18n';
import { escapeHtml } from '../../templates/layout';
import { resolveAuthMethod } from '../../middleware/auth';

const setup = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * セットアップ画面共通のHTMLシェル
 */
function shell(lang: Language, title: string, description: string, body: string, maxWidth: string): string {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
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
  <div class="${maxWidth} w-full py-8">
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-2xl shadow-lg mb-4">
        <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
        </svg>
      </div>
      <h1 class="text-3xl font-bold text-gray-900">${escapeHtml(description)}</h1>
    </div>
    ${body}
  </div>
</body>
</html>`;
}

/**
 * GET /setup
 * 認証方式の選択、または ?mode=saml でSAML設定フォーム
 */
setup.get('/', async (c) => {
  const lang = c.get('lang') || DEFAULT_LANGUAGE;
  const { get } = createTranslator(lang);

  // 既にセットアップ済みの場合はログインページへ
  const authMethod = await resolveAuthMethod(c.env, c.env.DB);
  if (authMethod !== 'setup') {
    return c.redirect('/login', 302);
  }

  const mode = c.req.query('mode');

  // エラーメッセージ
  const errorParam = c.req.query('error');
  let errorMessage = '';
  if (errorParam) {
    const errorMessages: Record<string, string> = {
      required: lang === 'ja' ? '必須項目が入力されていません。' : 'Required fields are missing.',
      cert: lang === 'ja' ? '証明書の内容が正しくありません。' : 'The certificate content is invalid.',
    };
    errorMessage = errorMessages[errorParam] || (lang === 'ja' ? '不明なエラーが発生しました。' : 'An unknown error occurred.');
  }

  const errorBlock = errorMessage ? `
      <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span class="text-sm text-red-700">${escapeHtml(errorMessage)}</span>
        </div>
      </div>` : '';

  const warningBlock = `
      <div class="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div class="flex items-start">
          <svg class="w-5 h-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-2.99l-6.93-12a2 2 0 00-3.48 0l-6.93 12A2 2 0 005.07 19z"/>
          </svg>
          <span class="text-sm text-amber-800">${get('setup.warning')}</span>
        </div>
      </div>`;

  // SAML設定フォーム
  if (mode === 'saml') {
    // SP側の値はアクセス中のURLから組み立てて初期値にする
    const origin = new URL(c.req.url).origin;

    const body = `
    <div class="bg-white rounded-2xl shadow-xl p-8">
      <h2 class="text-xl font-bold text-gray-900 mb-2">${get('setup.samlFormTitle')}</h2>
      <p class="text-sm text-gray-600 mb-6">${get('setup.samlFormLead')}</p>

      ${errorBlock}

      <form method="POST" action="/auth/setup/saml" class="space-y-6">
        <div>
          <h3 class="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">${get('setup.spSection')}</h3>
          <div class="space-y-4">
            <div>
              <label for="entity_id" class="block text-sm font-medium text-gray-700 mb-1">${get('setup.entityId')}</label>
              <input type="text" id="entity_id" name="entity_id" required value="${escapeHtml(origin)}"
                     class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
            </div>
            <div>
              <label for="callback_url" class="block text-sm font-medium text-gray-700 mb-1">${get('setup.callbackUrl')}</label>
              <input type="text" id="callback_url" name="callback_url" required value="${escapeHtml(origin + '/auth/saml/callback')}"
                     class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
            </div>
          </div>
        </div>

        <div>
          <h3 class="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">${get('setup.idpSection')}</h3>
          <div class="space-y-4">
            <div>
              <label for="idp_sso_url" class="block text-sm font-medium text-gray-700 mb-1">${get('setup.idpSsoUrl')}</label>
              <input type="text" id="idp_sso_url" name="idp_sso_url" required
                     class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
            </div>
            <div>
              <label for="idp_entity_id" class="block text-sm font-medium text-gray-700 mb-1">${get('setup.idpEntityId')}</label>
              <input type="text" id="idp_entity_id" name="idp_entity_id" required
                     class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
            </div>
            <div>
              <label for="idp_cert" class="block text-sm font-medium text-gray-700 mb-1">${get('setup.idpCert')}</label>
              <textarea id="idp_cert" name="idp_cert" required rows="6"
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-primary-500 focus:border-primary-500"></textarea>
              <p class="mt-1 text-xs text-gray-500">${get('setup.idpCertHint')}</p>
            </div>
            <div>
              <label for="allowed_domains" class="block text-sm font-medium text-gray-700 mb-1">${get('setup.allowedDomains')}</label>
              <input type="text" id="allowed_domains" name="allowed_domains"
                     class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
              <p class="mt-1 text-xs text-gray-500">${get('setup.allowedDomainsHint')}</p>
            </div>
          </div>
        </div>

        <button type="submit"
                class="w-full flex items-center justify-center px-6 py-3 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors shadow-md hover:shadow-lg">
          ${get('setup.samlSubmit')}
        </button>
      </form>

      <div class="mt-6 text-center">
        <a href="/setup" class="text-sm text-gray-500 hover:text-gray-700">${get('setup.back')}</a>
      </div>
    </div>`;

    return c.html(shell(lang, `${get('setup.title')} - ${get('common.appName')}`, get('setup.samlFormTitle'), body, 'max-w-2xl'));
  }

  // 認証方式の選択画面
  const body = `
    <div class="bg-white rounded-2xl shadow-xl p-8">
      <p class="text-sm text-gray-600 mb-4">${get('setup.lead')}</p>

      ${warningBlock}
      ${errorBlock}

      <div class="grid gap-4 md:grid-cols-2">
        <!-- ローカル認証 -->
        <div class="border border-gray-200 rounded-xl p-6 flex flex-col">
          <div class="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
            <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          </div>
          <h2 class="text-lg font-bold text-gray-900 mb-2">${get('setup.localTitle')}</h2>
          <p class="text-sm text-gray-600 mb-6 flex-grow">${get('setup.localDescription')}</p>
          <a href="/register"
             class="w-full flex items-center justify-center px-4 py-2.5 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors">
            ${get('setup.localAction')}
          </a>
        </div>

        <!-- SAML SSO -->
        <div class="border border-gray-200 rounded-xl p-6 flex flex-col">
          <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
            <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </div>
          <h2 class="text-lg font-bold text-gray-900 mb-2">${get('setup.samlTitle')}</h2>
          <p class="text-sm text-gray-600 mb-6 flex-grow">${get('setup.samlDescription')}</p>
          <a href="/setup?mode=saml"
             class="w-full flex items-center justify-center px-4 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">
            ${get('setup.samlAction')}
          </a>
        </div>
      </div>
    </div>

    <div class="mt-8 text-center text-sm text-gray-500">
      <p>${get('login.footer')}</p>
    </div>`;

  return c.html(shell(lang, `${get('setup.title')} - ${get('common.appName')}`, get('setup.description'), body, 'max-w-3xl'));
});

export default setup;
