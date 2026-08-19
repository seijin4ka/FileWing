/**
 * 法人向けファイルアップローダー
 * Cloudflare Workers + Hono + R2 + D1 で構築
 *
 * エントリーポイント
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env, Variables } from './types';
import { authMiddleware } from './middleware/auth';
import { languageMiddleware } from './middleware/language';
import { createTranslator, DEFAULT_LANGUAGE } from './i18n';

// API ルート
import filesApi from './routes/api/files';
import linksApi from './routes/api/links';
import emailApi from './routes/api/email';
import receiveApi from './routes/api/receive';
import exportApi from './routes/api/export';

// ページルート
import dashboard from './routes/pages/dashboard';
import upload from './routes/pages/upload';
import files from './routes/pages/files';
import download from './routes/pages/download';
import receive from './routes/pages/receive';
import receiveGuest from './routes/pages/receive-guest';
import costs from './routes/pages/costs';
import links from './routes/pages/links';
import login from './routes/pages/login';
import register from './routes/pages/register';

// 認証ルート
import auth from './routes/auth';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// =====================================================
// グローバルミドルウェア
// =====================================================

// ロギング
app.use('*', logger());

// セキュリティヘッダー
app.use('*', async (c, next) => {
  await next();

  // ダウンロードレスポンスにはCSPを適用しない
  const isDownload = c.req.path.startsWith('/d/') && c.req.path.endsWith('/download');

  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (!isDownload) {
    c.header('Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; img-src 'self' data:; font-src 'self'; connect-src 'self'");
  }
});

// 言語設定
app.use('*', languageMiddleware);

// CORS設定（必要に応じて調整）
app.use(
  '/api/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// =====================================================
// 公開ルート（認証不要）
// =====================================================

// ログインページ
app.route('/login', login);

// 管理者登録ページ（ローカル認証で管理者が未登録の場合のみ表示）
app.route('/register', register);

// 認証ルート（SAML SSO）
app.route('/auth', auth);

// ダウンロードページ
app.route('/d', download);

// ダウンロードAPI（認証不要）
app.get('/d/:token/download', async (c) => {
  // linksApi のハンドラに委譲
  const linksHandler = new Hono<{ Bindings: Env; Variables: Variables }>();
  linksHandler.route('/', linksApi);
  return linksHandler.fetch(c.req.raw, c.env, c.executionCtx);
});

// ゲスト受信ページ（公開）
app.route('/r', receiveGuest);

// =====================================================
// 認証が必要なルート
// =====================================================

// 認証ミドルウェアを適用
app.use('/*', authMiddleware);

// API ルート
app.route('/api/files', filesApi);
app.route('/api', linksApi);
app.route('/api', emailApi);
app.route('/api', receiveApi);
app.route('/api', exportApi);

// ページルート
app.route('/', dashboard);
app.route('/upload', upload);
app.route('/files', files);
app.route('/links', links);
app.route('/receive', receive);
app.route('/costs', costs);

// =====================================================
// エラーハンドリング
// =====================================================

app.onError((err, c) => {
  console.error('エラー:', err);
  return c.json(
    {
      success: false,
      error: '内部エラーが発生しました',
    },
    500
  );
});

// 404ハンドリング
app.notFound((c) => {
  // APIリクエストの場合はJSON
  if (c.req.path.startsWith('/api/')) {
    return c.json({ success: false, error: 'エンドポイントが見つかりません' }, 404);
  }

  // 言語を取得
  const lang = c.get('lang') || DEFAULT_LANGUAGE;
  const { get } = createTranslator(lang);

  // それ以外はHTMLページ
  return c.html(
    `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${get('notFound.title')} - ${get('common.appName')}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
  <div class="text-center">
    <h1 class="text-6xl font-bold text-gray-300">404</h1>
    <p class="mt-4 text-xl text-gray-600">${get('notFound.message')}</p>
    <a href="/" class="mt-6 inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
      ${get('notFound.backHome')}
    </a>
  </div>
</body>
</html>`,
    404
  );
});

// 定期クリーンアップジョブ
import { handleScheduled } from './scheduled';

export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
};
