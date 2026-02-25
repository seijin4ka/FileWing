/**
 * ダウンロードページ（公開）
 * 認証不要でアクセス可能なダウンロード画面
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';
import { layout, formatFileSize, localDateTime, escapeHtml, escapeJsString, renderErrorPage } from '../../templates/layout';
import { getFileIcon } from '../../templates/components/card';
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
    const errorTitle = get('download.invalidLink');
    const errorMessage = get('download.invalidLinkMsg');
    const errorReasons = [
      get('download.invalidLinkReason1'),
      get('download.invalidLinkReason2'),
      get('download.invalidLinkReason3'),
    ];
    return c.html(
      layout(
        { title: errorTitle, hideHeader: true, lang },
        renderErrorPage(errorMessage, errorReasons, get('download.contactSender'))
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
          <h1 class="text-2xl font-bold text-gray-900">${get('download.title')}</h1>
        </div>

        <!-- ファイル情報カード -->
        <div class="bg-white rounded-lg shadow-lg border overflow-hidden">
          <div class="p-6">
            <!-- ファイル情報 -->
            <div class="flex items-center space-x-4 mb-6">
              <div class="flex-shrink-0 h-14 w-14 bg-gray-100 rounded-lg flex items-center justify-center">
                ${getFileIcon(file.mime_type, 'w-7 h-7')}
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
                  ${get('download.expiresAt')}
                </span>
                ${localDateTime(expires_at)}
              </div>
              ${remainingDownloads !== null ? `
              <div class="flex items-center justify-between text-gray-600">
                <span class="flex items-center">
                  <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                  </svg>
                  ${get('download.remainingDownloads')}
                </span>
                <span>${remainingDownloads}${get('download.times') ? ' ' + get('download.times') : ''}</span>
              </div>
              ` : ''}
              ${requiresPassword ? `
              <div class="flex items-center text-amber-600 bg-amber-50 -mx-6 px-6 py-2 mt-4">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
                ${get('download.passwordProtected')}
              </div>
              ` : ''}
            </div>

            <!-- ダウンロードフォーム -->
            <form id="download-form" class="space-y-4">
              ${requiresPassword ? `
              <div>
                <label for="password" class="block text-sm font-medium text-gray-700 mb-1">${get('download.password')}</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  required
                  placeholder="${get('download.passwordPlaceholder')}"
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
                ${get('download.downloadButton')}
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
      const i18n = ${JSON.stringify({
        downloadFailed: get('download.downloadFailed'),
        downloadComplete: get('download.downloadComplete'),
      })};

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
          const headers = {};
          if (password) headers['X-Download-Password'] = password;

          const response = await fetch('/d/${token}/download', { headers });

          if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || i18n.downloadFailed);
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
          btn.innerHTML = '<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' + i18n.downloadComplete;
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
export default download;
