/**
 * ダウンロードページ（公開）
 * 認証不要でアクセス可能なダウンロード画面
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';
import { layout, formatFileSize, localDateTime, escapeHtml, escapeJsString } from '../../templates/layout';
import { getValidLinkByToken } from '../../services/d1';
import { createTranslator } from '../../i18n';

const download = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /d/:token
 * ダウンロードページ
 */
download.get('/:token', async (c) => {
  const token = c.req.param('token');
  const lang = c.get('lang') || 'ja';
  const { get } = createTranslator(lang);

  // リンク情報を取得
  const linkWithFile = await getValidLinkByToken(c.env.DB, token);

  // 無効なリンクの場合
  if (!linkWithFile) {
    const errorTitle = lang === 'ja' ? 'リンクが無効です' : 'Invalid Link';
    const errorMessage = lang === 'ja' ? 'このリンクは無効か期限切れです' : 'This link is invalid or expired';
    const errorReasons = lang === 'ja'
      ? [
          'リンクの有効期限が切れている可能性があります',
          'リンクが無効化されている可能性があります',
          '最大ダウンロード回数に達した可能性があります',
        ]
      : [
          'The link may have expired',
          'The link may have been disabled',
          'Maximum download count may have been reached',
        ];
    return c.html(
      layout(
        { title: errorTitle, hideHeader: true, lang },
        renderErrorPage(errorMessage, errorReasons)
      )
    );
  }

  const { file, password_hash, expires_at, max_downloads, download_count } = linkWithFile;

  // パスワード保護されている場合
  const requiresPassword = !!password_hash;

  // 残りダウンロード回数
  const remainingDownloads = max_downloads
    ? max_downloads - download_count
    : null;

  const content = `
    <div class="min-h-screen flex items-center justify-center py-12 px-4">
      <div class="max-w-md w-full">
        <!-- ロゴ/タイトル -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            <svg class="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-gray-900">ファイルをダウンロード</h1>
        </div>

        <!-- ファイル情報カード -->
        <div class="bg-white rounded-lg shadow-lg border overflow-hidden">
          <div class="p-6">
            <!-- ファイル情報 -->
            <div class="flex items-center space-x-4 mb-6">
              <div class="flex-shrink-0 h-14 w-14 bg-gray-100 rounded-lg flex items-center justify-center">
                ${getFileIcon(file.mime_type)}
              </div>
              <div class="flex-1 min-w-0">
                <h2 class="text-lg font-medium text-gray-900 truncate">${escapeHtml(file.original_name)}</h2>
                <div class="flex items-center space-x-3 text-sm text-gray-500">
                  <span>${formatFileSize(file.size)}</span>
                  <span>•</span>
                  <span>${file.mime_type.split('/')[1] || file.mime_type}</span>
                </div>
              </div>
            </div>

            <!-- メタ情報 -->
            <div class="space-y-2 mb-6 text-sm">
              <div class="flex items-center justify-between text-gray-600">
                <span class="flex items-center">
                  <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  有効期限
                </span>
                ${localDateTime(expires_at)}
              </div>
              ${remainingDownloads !== null ? `
              <div class="flex items-center justify-between text-gray-600">
                <span class="flex items-center">
                  <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                  </svg>
                  残りダウンロード回数
                </span>
                <span>${remainingDownloads} 回</span>
              </div>
              ` : ''}
              ${requiresPassword ? `
              <div class="flex items-center text-amber-600 bg-amber-50 -mx-6 px-6 py-2 mt-4">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
                このファイルはパスワードで保護されています
              </div>
              ` : ''}
            </div>

            <!-- ダウンロードフォーム -->
            <form id="download-form" class="space-y-4">
              ${requiresPassword ? `
              <div>
                <label for="password" class="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  required
                  placeholder="パスワードを入力"
                  class="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              ` : ''}

              <button
                type="submit"
                id="download-btn"
                class="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              >
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
                ダウンロード
              </button>
            </form>

            <!-- エラー表示 -->
            <div id="error-message" class="hidden mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            </div>
          </div>

          <!-- フッター -->
          <div class="bg-gray-50 px-6 py-4 text-center text-xs text-gray-500">
            FileWing - Secure File Sharing
          </div>
        </div>
      </div>
    </div>

    <script>
      document.getElementById('download-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = document.getElementById('download-btn');
        const errorDiv = document.getElementById('error-message');
        const originalText = btn.innerHTML;

        btn.disabled = true;
        btn.innerHTML = '<div class="spinner mx-auto"></div>';
        errorDiv.classList.add('hidden');

        try {
          const password = document.getElementById('password')?.value || '';
          const url = '/d/${token}/download' + (password ? '?password=' + encodeURIComponent(password) : '');

          const response = await fetch(url);

          if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || 'ダウンロードに失敗しました');
          }

          // ファイルをダウンロード
          const blob = await response.blob();
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = '${escapeJsString(file.original_name)}';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(downloadUrl);
          a.remove();

          // 成功メッセージ
          btn.innerHTML = '<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>ダウンロード完了';
          btn.classList.remove('bg-primary-600', 'hover:bg-primary-700');
          btn.classList.add('bg-green-600');

          // ページをリロードして残りダウンロード回数を更新
          setTimeout(() => {
            location.reload();
          }, 2000);

        } catch (error) {
          errorDiv.textContent = error.message;
          errorDiv.classList.remove('hidden');
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      });
    </script>
  `;

  return c.html(layout({ title: get('download.title'), hideHeader: true, bodyClass: 'bg-gray-100', lang }, content));
});

/**
 * エラーページをレンダリング
 */
function renderErrorPage(title: string, reasons: string[]): string {
  return `
    <div class="min-h-screen flex items-center justify-center py-12 px-4">
      <div class="max-w-md w-full text-center">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-6">
          <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 mb-4">${title}</h1>
        <div class="bg-white rounded-lg shadow-sm border p-6 text-left">
          <p class="text-gray-600 mb-4">考えられる原因:</p>
          <ul class="space-y-2 text-sm text-gray-500">
            ${reasons.map((r) => `<li class="flex items-start"><span class="mr-2">•</span>${r}</li>`).join('')}
          </ul>
        </div>
        <p class="mt-6 text-sm text-gray-500">
          問題が解決しない場合は、ファイルの送信者にお問い合わせください。
        </p>
      </div>
    </div>
  `;
}

/**
 * ファイルタイプに応じたアイコン
 */
function getFileIcon(mimeType: string): string {
  const type = mimeType.split('/')[0];

  if (type === 'image') {
    return `<svg class="w-7 h-7 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
    </svg>`;
  }

  if (mimeType === 'application/pdf') {
    return `<svg class="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
    </svg>`;
  }

  if (mimeType.includes('zip') || mimeType.includes('compressed')) {
    return `<svg class="w-7 h-7 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
    </svg>`;
  }

  return `<svg class="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
  </svg>`;
}

export default download;
