/**
 * ファイル一覧・詳細ページ
 * アップロードしたファイルの管理画面
 */

import { Hono } from 'hono';
import type { Env, Variables, DownloadLink } from '../../types';
import { layout, formatFileSize, localDateTime, escapeHtml } from '../../templates/layout';
import { button, linkButton } from '../../templates/components/button';
import { badge } from '../../templates/components/table';
import { icons, getFileIcon } from '../../templates/components/card';
import {
  getFileById,
  getFilesWithLinkStatsByUser,
  getLinksByFile,
} from '../../services/d1';
import { createTranslator } from '../../i18n';

const files = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /files
 * ファイル一覧画面
 */
files.get('/', async (c) => {
  const user = c.get('user');
  const userId = c.get('userId');
  const lang = c.get('lang') || 'ja';
  const { get } = createTranslator(lang);

  // ファイル一覧をリンク統計と共に取得（N+1解消）
  const filesWithStats = await getFilesWithLinkStatsByUser(c.env.DB, userId);

  const fileCountText = lang === 'ja' ? `${filesWithStats.length} 件のファイル` : `${filesWithStats.length} files`;
  const noFilesDesc = lang === 'ja' ? '最初のファイルをアップロードしましょう' : 'Upload your first file';
  const activeText = lang === 'ja' ? '有効' : 'active';
  const noneText = lang === 'ja' ? 'なし' : 'none';
  const timesText = lang === 'ja' ? '回' : '';
  const detailsText = lang === 'ja' ? '詳細' : 'Details';
  const linksText = lang === 'ja' ? 'リンク' : 'Links';
  const downloadsText = lang === 'ja' ? 'ダウンロード' : 'Downloads';
  const createdText = lang === 'ja' ? '作成日' : 'Created';
  const deleteConfirmText = lang === 'ja'
    ? '「\' + fileName + \'」を削除してもよろしいですか？\\n\\nこの操作は取り消せません。関連するダウンロードリンクも無効になります。'
    : 'Delete "\' + fileName + \'"?\\n\\nThis action cannot be undone. Related download links will be disabled.';
  const deleteSuccessText = lang === 'ja' ? 'ファイルを削除しました' : 'File deleted';
  const deleteErrorText = lang === 'ja' ? '削除に失敗しました' : 'Delete failed';
  const errorText = lang === 'ja' ? 'エラーが発生しました' : 'An error occurred';

  const content = `
    <div class="space-y-6">
      <!-- ページヘッダー -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">${get('files.title')}</h1>
          <p class="text-gray-600">${fileCountText}</p>
        </div>
        ${linkButton({ text: get('common.upload'), href: '/upload', variant: 'primary', icon: icons.upload })}
      </div>

      <!-- ファイル一覧 -->
      <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
        ${filesWithStats.length === 0 ? `
          <div class="px-6 py-12 text-center">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
            </svg>
            <h3 class="mt-4 text-lg font-medium text-gray-900">${get('files.noFiles')}</h3>
            <p class="mt-2 text-gray-500">${noFilesDesc}</p>
            <div class="mt-6">
              ${linkButton({ text: get('common.upload'), href: '/upload', variant: 'primary' })}
            </div>
          </div>
        ` : `
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${get('files.fileName')}</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${get('files.size')}</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${linksText}</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${downloadsText}</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${createdText}</th>
                  <th scope="col" class="relative px-6 py-3"><span class="sr-only">${get('files.actions')}</span></th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                ${filesWithStats.map((file) => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4">
                      <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          ${getFileIcon(file.mime_type)}
                        </div>
                        <div class="ml-4">
                          <div class="text-sm font-medium text-gray-900">${escapeHtml(file.original_name)}</div>
                          <div class="text-sm text-gray-500">${escapeHtml(file.mime_type)}</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${formatFileSize(file.size)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      ${file.active_link_count > 0
                        ? badge({ text: `${file.active_link_count} ${activeText}`, variant: 'success' })
                        : badge({ text: noneText, variant: 'default' })
                      }
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${file.total_downloads}${timesText ? ` ${timesText}` : ''}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${localDateTime(file.created_at)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div class="flex items-center justify-end space-x-2">
                        <a href="/files/${file.id}" class="text-primary-600 hover:text-primary-900">${detailsText}</a>
                        <button type="button" onclick="deleteFile(${file.id}, '${escapeHtml(file.original_name).replace(/'/g, "\\'")}')" class="text-red-600 hover:text-red-900">${get('common.delete')}</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>

    <script>
      async function deleteFile(fileId, fileName) {
        if (!confirm('${deleteConfirmText}')) {
          return;
        }

        try {
          const res = await fetch('/api/files/' + fileId, { method: 'DELETE' });
          const result = await res.json();

          if (result.success) {
            showToast('${deleteSuccessText}', 'success');
            location.reload();
          } else {
            showToast(result.error || '${deleteErrorText}', 'error');
          }
        } catch (error) {
          showToast('${errorText}', 'error');
        }
      }
    </script>
  `;

  return c.html(layout({ title: get('files.title'), user, lang }, content));
});

/**
 * GET /files/:id
 * ファイル詳細画面
 */
files.get('/:id', async (c) => {
  const user = c.get('user');
  const userId = c.get('userId');
  const lang = c.get('lang') || 'ja';
  // createTranslator is available if needed for future translations
  const fileId = parseInt(c.req.param('id'), 10);

  if (isNaN(fileId)) {
    return c.redirect('/files');
  }

  // ファイル情報を取得
  const file = await getFileById(c.env.DB, fileId);

  if (!file || file.user_id !== userId) {
    return c.redirect('/files');
  }

  // リンク一覧を取得
  const links = await getLinksByFile(c.env.DB, file.id);

  // URL生成用
  const baseUrl = new URL(c.req.url).origin;

  const content = `
    <div class="space-y-6">
      <!-- パンくずリスト -->
      <nav class="text-sm">
        <ol class="flex items-center space-x-2">
          <li><a href="/files" class="text-gray-500 hover:text-gray-700">ファイル一覧</a></li>
          <li class="text-gray-400">/</li>
          <li class="text-gray-900 font-medium">${escapeHtml(file.original_name)}</li>
        </ol>
      </nav>

      <!-- ファイル情報 -->
      <div class="bg-white rounded-lg shadow-sm border p-6">
        <div class="flex items-start justify-between">
          <div class="flex items-center space-x-4">
            <div class="flex-shrink-0 h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center">
              ${getFileIcon(file.mime_type, 'w-8 h-8')}
            </div>
            <div>
              <h1 class="text-xl font-bold text-gray-900">${escapeHtml(file.original_name)}</h1>
              <div class="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                <span>${formatFileSize(file.size)}</span>
                <span>•</span>
                <span>${escapeHtml(file.mime_type)}</span>
                <span>•</span>
                <span>${localDateTime(file.created_at)}</span>
              </div>
            </div>
          </div>
          <button type="button" onclick="deleteFile(${file.id}, '${escapeHtml(file.original_name).replace(/'/g, "\\'")}')" class="text-red-600 hover:text-red-900 text-sm font-medium">
            削除
          </button>
        </div>
      </div>

      <!-- リンク作成 -->
      <div class="bg-white rounded-lg shadow-sm border p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">新しいリンクを作成</h2>
        <form id="create-link-form" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label for="expires_days" class="block text-sm font-medium text-gray-700 mb-1">有効期限</label>
              <select id="expires_days" name="expires_days" class="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                <option value="1">1日</option>
                <option value="3">3日</option>
                <option value="7" selected>7日</option>
                <option value="10">10日</option>
              </select>
            </div>
            <div>
              <label for="password" class="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
              <input type="password" id="password" name="password" placeholder="オプション" class="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
            <div>
              <label for="max_downloads" class="block text-sm font-medium text-gray-700 mb-1">最大DL数</label>
              <input type="number" id="max_downloads" name="max_downloads" placeholder="無制限" min="1" class="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
          </div>
          ${button({ text: 'リンクを作成', type: 'submit', variant: 'primary' })}
        </form>
      </div>

      <!-- リンク一覧 -->
      <div class="bg-white rounded-lg shadow-sm border">
        <div class="px-6 py-4 border-b">
          <h2 class="text-lg font-semibold text-gray-900">ダウンロードリンク</h2>
        </div>
        ${links.length === 0 ? `
          <div class="px-6 py-12 text-center text-gray-500">
            まだリンクが作成されていません
          </div>
        ` : `
          <div class="divide-y">
            ${links.map((link: DownloadLink) => renderLinkItem(link, baseUrl)).join('')}
          </div>
        `}
      </div>
    </div>

    <!-- リンク詳細モーダル -->
    <div id="link-modal" class="hidden fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="px-6 py-4 border-b flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900">リンク詳細</h3>
          <button type="button" onclick="closeModal()" class="text-gray-400 hover:text-gray-500">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div id="modal-content" class="p-6">
          <!-- 動的に内容を挿入 -->
        </div>
      </div>
    </div>

    <script>
      const fileId = ${file.id};
      const baseUrl = '${baseUrl}';

      // リンク作成
      document.getElementById('create-link-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
          expires_days: parseInt(document.getElementById('expires_days').value),
          password: document.getElementById('password').value || undefined,
          max_downloads: document.getElementById('max_downloads').value
            ? parseInt(document.getElementById('max_downloads').value)
            : undefined,
        };

        try {
          const res = await fetch('/api/files/' + fileId + '/links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });

          const result = await res.json();

          if (result.success) {
            showToast('リンクを作成しました', 'success');
            location.reload();
          } else {
            showToast(result.error || '作成に失敗しました', 'error');
          }
        } catch (error) {
          showToast('エラーが発生しました', 'error');
        }
      });

      // URLをコピー
      function copyUrl(token) {
        const url = baseUrl + '/d/' + token;
        navigator.clipboard.writeText(url).then(() => {
          showToast('リンクをコピーしました', 'success');
        });
      }

      // リンク無効化
      async function disableLink(linkId) {
        if (!confirm('このリンクを無効化しますか？')) {
          return;
        }

        try {
          const res = await fetch('/api/links/' + linkId, { method: 'DELETE' });
          const result = await res.json();

          if (result.success) {
            showToast('リンクを無効化しました', 'success');
            location.reload();
          } else {
            showToast(result.error || '無効化に失敗しました', 'error');
          }
        } catch (error) {
          showToast('エラーが発生しました', 'error');
        }
      }

      // リンク詳細を表示
      async function showLinkDetails(linkId) {
        try {
          const res = await fetch('/api/links/' + linkId + '/stats');
          const result = await res.json();

          if (!result.success) {
            showToast(result.error || '取得に失敗しました', 'error');
            return;
          }

          const stats = result.stats;
          const modalContent = document.getElementById('modal-content');
          modalContent.innerHTML = \`
            <div class="space-y-6">
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-gray-50 rounded-lg p-4">
                  <p class="text-sm text-gray-500">総ダウンロード数</p>
                  <p class="text-2xl font-bold text-gray-900">\${stats.total_downloads}</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-4">
                  <p class="text-sm text-gray-500">ユニークIP数</p>
                  <p class="text-2xl font-bold text-gray-900">\${stats.unique_ips}</p>
                </div>
              </div>

              \${stats.recipients.length > 0 ? \`
                <div>
                  <h4 class="text-sm font-medium text-gray-900 mb-2">送信先</h4>
                  <div class="space-y-1">
                    \${stats.recipients.map(r => \`
                      <div class="text-sm text-gray-600">\${escHtml(r.email)} <span class="text-gray-400">(\${formatDate(r.sent_at)})</span></div>
                    \`).join('')}
                  </div>
                </div>
              \` : ''}

              \${stats.recent_logs.length > 0 ? \`
                <div>
                  <h4 class="text-sm font-medium text-gray-900 mb-2">最近のダウンロード</h4>
                  <div class="overflow-x-auto">
                    <table class="min-w-full text-sm">
                      <thead>
                        <tr class="border-b">
                          <th class="text-left py-2">日時</th>
                          <th class="text-left py-2">IPアドレス</th>
                          <th class="text-left py-2">ユーザーエージェント</th>
                        </tr>
                      </thead>
                      <tbody>
                        \${stats.recent_logs.map(log => \`
                          <tr class="border-b">
                            <td class="py-2">\${formatDate(log.downloaded_at)}</td>
                            <td class="py-2">\${escHtml(log.ip_address) || '-'}</td>
                            <td class="py-2 truncate max-w-xs" title="\${escHtml(log.user_agent || '')}">\${escHtml(log.user_agent) || '-'}</td>
                          </tr>
                        \`).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              \` : '<p class="text-gray-500 text-center">まだダウンロードされていません</p>'}
            </div>
          \`;

          document.getElementById('link-modal').classList.remove('hidden');
        } catch (error) {
          showToast('エラーが発生しました', 'error');
        }
      }

      function closeModal() {
        document.getElementById('link-modal').classList.add('hidden');
      }

      // モーダル外クリックで閉じる
      document.getElementById('link-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
          closeModal();
        }
      });

      // ファイル削除
      async function deleteFile(fileId, fileName) {
        if (!confirm('「' + fileName + '」を削除してもよろしいですか？\\n\\nこの操作は取り消せません。')) {
          return;
        }

        try {
          const res = await fetch('/api/files/' + fileId, { method: 'DELETE' });
          const result = await res.json();

          if (result.success) {
            showToast('ファイルを削除しました', 'success');
            location.href = '/files';
          } else {
            showToast(result.error || '削除に失敗しました', 'error');
          }
        } catch (error) {
          showToast('エラーが発生しました', 'error');
        }
      }
    </script>
  `;

  return c.html(layout({ title: file.original_name, user, lang }, content));
});

/**
 * リンクアイテムをレンダリング
 */
function renderLinkItem(link: DownloadLink, baseUrl: string): string {
  const isExpired = new Date(link.expires_at) < new Date();
  const isDisabled = !!link.disabled_at;
  const isActive = !isExpired && !isDisabled;
  const hasReachedLimit =
    link.max_downloads !== null && link.download_count >= link.max_downloads;

  let status: { text: string; variant: 'success' | 'warning' | 'error' | 'info' | 'default' } = { text: '有効', variant: 'success' };
  if (isDisabled) {
    status = { text: '無効化済み', variant: 'default' };
  } else if (isExpired) {
    status = { text: '期限切れ', variant: 'error' };
  } else if (hasReachedLimit) {
    status = { text: 'DL上限', variant: 'warning' };
  }

  return `
    <div class="px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex-1 min-w-0">
          <div class="flex items-center space-x-3">
            ${badge(status)}
            ${link.password_hash ? badge({ text: 'パスワード', variant: 'info' }) : ''}
          </div>
          <div class="mt-2 flex items-center space-x-4 text-sm text-gray-500">
            <span>DL: ${link.download_count}${link.max_downloads ? `/${link.max_downloads}` : ''}</span>
            <span>•</span>
            <span>期限: ${localDateTime(link.expires_at)}</span>
            <span>•</span>
            <span>作成: ${localDateTime(link.created_at)}</span>
          </div>
          ${isActive ? `
          <div class="mt-2">
            <code class="text-xs bg-gray-100 px-2 py-1 rounded">${baseUrl}/d/${link.token}</code>
          </div>
          ` : ''}
        </div>
        <div class="flex items-center space-x-2 ml-4">
          <button type="button" onclick="showLinkDetails(${link.id})" class="text-gray-500 hover:text-gray-700 p-2" title="詳細">
            ${icons.eye}
          </button>
          ${isActive ? `
            <button type="button" onclick="copyUrl('${link.token}')" class="text-gray-500 hover:text-gray-700 p-2" title="コピー">
              ${icons.copy}
            </button>
            <button type="button" onclick="disableLink(${link.id})" class="text-red-500 hover:text-red-700 p-2" title="無効化">
              ${icons.trash}
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}
export default files;
