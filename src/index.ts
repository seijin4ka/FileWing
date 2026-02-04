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

// API ルート
import filesApi from './routes/api/files';
import linksApi from './routes/api/links';
import emailApi from './routes/api/email';
import receiveApi from './routes/api/receive';

// ページルート
import dashboard from './routes/pages/dashboard';
import upload from './routes/pages/upload';
import files from './routes/pages/files';
import download from './routes/pages/download';
import receive from './routes/pages/receive';
import receiveGuest from './routes/pages/receive-guest';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// =====================================================
// グローバルミドルウェア
// =====================================================

// ロギング
app.use('*', logger());

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
app.use('/api/*', authMiddleware);

// API ルート
app.route('/api/files', filesApi);
app.route('/api', linksApi);
app.route('/api', emailApi);
app.route('/api', receiveApi);

// ページルート
app.route('/', dashboard);
app.route('/upload', upload);
app.route('/files', files);
app.route('/receive', receive);

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

  // それ以外はHTMLページ
  return c.html(
    `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ページが見つかりません - ファイル共有システム</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
  <div class="text-center">
    <h1 class="text-6xl font-bold text-gray-300">404</h1>
    <p class="mt-4 text-xl text-gray-600">ページが見つかりません</p>
    <a href="/" class="mt-6 inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
      ホームに戻る
    </a>
  </div>
</body>
</html>`,
    404
  );
});

export default app;
