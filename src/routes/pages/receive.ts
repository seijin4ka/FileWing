/**
 * 受信リンク管理ページ
 * 受信リンクの作成と管理
 */

import { Hono } from 'hono';
import type { Env, Variables, ReceiveLink } from '../../types';
import { layout, formatFileSize, formatDateTime, escapeHtml } from '../../templates/layout';
import { button } from '../../templates/components/button';
import { badge } from '../../templates/components/table';
import { icons } from '../../templates/components/card';
import {
  getReceiveLinksByUser,
  getReceiveLinkById,
  getReceivedFilesByLink,
  getReceivedFileCount,
} from '../../services/d1';

const receive = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /receive
 * 受信リンク一覧・作成画面
 */
receive.get('/', async (c) => {
  const user = c.get('user');
  const userId = c.get('userId');

  // 受信リンク一覧を取得
  const links = await getReceiveLinksByUser(c.env.DB, userId);

  // 各リンクのファイル数を取得
  const linksWithStats = await Promise.all(
    links.map(async (link) => {
      const fileCount = await getReceivedFileCount(c.env.DB, link.id);
      const isActive = !link.disabled_at && new Date(link.expires_at) > new Date();
      return { ...link, file_count: fileCount, is_active: isActive };
    })
  );

  const baseUrl = new URL(c.req.url).origin;

  const content = `
    <div class="space-y-6">
      <!-- ページヘッダー -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">受信</h1>
          <p class="text-gray-600">外部からファイルを受け取るリンクを作成</p>
        </div>
      </div>

      <!-- リンク作成フォーム -->
      <div class="bg-white rounded-lg shadow-sm border p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">新しい受信リンクを作成</h2>
        <form id="create-link-form" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label for="title" class="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
              <input type="text" id="title" name="title" placeholder="受信リンクの説明" class="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
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
              <label for="max_files" class="block text-sm font-medium text-gray-700 mb-1">最大ファイル数</label>
              <input type="number" id="max_files" name="max_files" placeholder="無制限" min="1" class="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
            <div>
              <label for="password" class="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
              <input type="password" id="password" name="password" placeholder="オプション" class="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
          </div>
          ${button({ text: '受信リンクを作成', type: 'submit', variant: 'accent' })}
        </form>
      </div>

      <!-- 作成結果表示 -->
      <div id="create-result" class="hidden bg-green-50 border border-green-200 rounded-lg p-6">
        <div class="flex items-start">
          <svg class="w-6 h-6 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div class="ml-3 flex-1">
            <h3 class="text-lg font-medium text-green-800">受信リンクを作成しました</h3>
            <div class="mt-2">
              <label class="block text-sm font-medium text-green-700">受信用URL</label>
              <div class="mt-1 flex rounded-md shadow-sm">
                <input type="text" id="created-url" readonly class="flex-1 min-w-0 block px-3 py-2 rounded-l-md border border-green-300 bg-white text-sm" />
                <button type="button" onclick="copyCreatedUrl()" class="inline-flex items-center px-4 py-2 border border-l-0 border-green-300 rounded-r-md bg-green-50 text-sm font-medium text-green-700 hover:bg-green-100">
                  コピー
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 受信リンク一覧 -->
      <div class="bg-white rounded-lg shadow-sm border">
        <div class="px-6 py-4 border-b">
          <h2 class="text-lg font-semibold text-gray-900">受信リンク一覧</h2>
        </div>
        ${linksWithStats.length === 0 ? `
          <div class="px-6 py-12 text-center text-gray-500">
            まだ受信リンクがありません
          </div>
        ` : `
          <div class="divide-y">
            ${linksWithStats.map((link) => renderLinkItem(link, baseUrl)).join('')}
          </div>
        `}
      </div>
    </div>

    <script>
      // リンク作成
      document.getElementById('create-link-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
          title: document.getElementById('title').value || undefined,
          expires_days: parseInt(document.getElementById('expires_days').value),
          max_files: document.getElementById('max_files').value
            ? parseInt(document.getElementById('max_files').value)
            : undefined,
          password: document.getElementById('password').value || undefined,
        };

        try {
          const res = await fetch('/api/receive-links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });

          const result = await res.json();

          if (result.success) {
            document.getElementById('created-url').value = result.link.url;
            document.getElementById('create-result').classList.remove('hidden');
            showToast('受信リンクを作成しました', 'success');
            // フォームをリセット
            document.getElementById('create-link-form').reset();
            // 少し待ってからリロード
            setTimeout(() => location.reload(), 2000);
          } else {
            showToast(result.error || '作成に失敗しました', 'error');
          }
        } catch (error) {
          showToast('エラーが発生しました', 'error');
        }
      });

      function copyCreatedUrl() {
        const urlInput = document.getElementById('created-url');
        urlInput.select();
        document.execCommand('copy');
        showToast('リンクをコピーしました', 'success');
      }

      function copyUrl(token) {
        const url = '${baseUrl}/r/' + token;
        navigator.clipboard.writeText(url).then(() => {
          showToast('リンクをコピーしました', 'success');
        });
      }

      async function disableLink(linkId) {
        if (!confirm('この受信リンクを無効化しますか？')) {
          return;
        }

        try {
          const res = await fetch('/api/receive-links/' + linkId, { method: 'DELETE' });
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
    </script>
  `;

  return c.html(layout({ title: '受信', user }, content));
});

/**
 * GET /receive/:id
 * 受信リンク詳細画面
 */
receive.get('/:id', async (c) => {
  const user = c.get('user');
  const userId = c.get('userId');
  const linkId = parseInt(c.req.param('id'), 10);

  if (isNaN(linkId)) {
    return c.redirect('/receive');
  }

  const link = await getReceiveLinkById(c.env.DB, linkId);

  if (!link || link.user_id !== userId) {
    return c.redirect('/receive');
  }

  const files = await getReceivedFilesByLink(c.env.DB, linkId);
  const baseUrl = new URL(c.req.url).origin;
  const isActive = !link.disabled_at && new Date(link.expires_at) > new Date();

  const content = `
    <div class="space-y-6">
      <!-- パンくずリスト -->
      <nav class="text-sm">
        <ol class="flex items-center space-x-2">
          <li><a href="/receive" class="text-gray-500 hover:text-gray-700">受信</a></li>
          <li class="text-gray-400">/</li>
          <li class="text-gray-900 font-medium">${link.title ? escapeHtml(link.title) : `リンク #${link.id}`}</li>
        </ol>
      </nav>

      <!-- リンク情報 -->
      <div class="bg-white rounded-lg shadow-sm border p-6">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center space-x-3">
              <h1 class="text-xl font-bold text-gray-900">${link.title ? escapeHtml(link.title) : `受信リンク #${link.id}`}</h1>
              ${isActive ? badge({ text: '有効', variant: 'success' }) : badge({ text: '無効', variant: 'default' })}
            </div>
            <div class="mt-2 space-y-1 text-sm text-gray-500">
              <p>作成日: ${formatDateTime(link.created_at)}</p>
              <p>有効期限: ${formatDateTime(link.expires_at)}</p>
              ${link.max_files ? `<p>最大ファイル数: ${link.max_files}</p>` : ''}
              <p>受信ファイル数: ${files.length}</p>
            </div>
            ${isActive ? `
            <div class="mt-4">
              <label class="block text-sm font-medium text-gray-700">受信用URL</label>
              <div class="mt-1 flex items-center space-x-2">
                <code class="text-xs bg-gray-100 px-2 py-1 rounded flex-1">${baseUrl}/r/${link.token}</code>
                <button type="button" onclick="copyUrl('${link.token}')" class="text-primary-500 hover:text-primary-600">
                  ${icons.copy}
                </button>
              </div>
            </div>
            ` : ''}
          </div>
          ${isActive ? `
          <button type="button" onclick="disableLink(${link.id})" class="text-red-600 hover:text-red-800 text-sm font-medium">
            無効化
          </button>
          ` : ''}
        </div>
      </div>

      <!-- 受信ファイル一覧 -->
      <div class="bg-white rounded-lg shadow-sm border">
        <div class="px-6 py-4 border-b">
          <h2 class="text-lg font-semibold text-gray-900">受信ファイル</h2>
        </div>
        ${files.length === 0 ? `
          <div class="px-6 py-12 text-center text-gray-500">
            まだファイルを受信していません
          </div>
        ` : `
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ファイル</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">送信者</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">受信日時</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状態</th>
                  <th class="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                ${files.map((file) => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4">
                      <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                          </svg>
                        </div>
                        <div class="ml-4">
                          <div class="text-sm font-medium text-gray-900">${escapeHtml(file.original_name)}</div>
                          <div class="text-sm text-gray-500">${formatFileSize(file.size)}</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4">
                      <div class="text-sm text-gray-900">${file.sender_name ? escapeHtml(file.sender_name) : '-'}</div>
                      <div class="text-sm text-gray-500">${file.sender_email ? escapeHtml(file.sender_email) : ''}</div>
                      ${file.message ? `<div class="text-xs text-gray-400 mt-1">${escapeHtml(file.message)}</div>` : ''}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      ${formatDateTime(file.uploaded_at)}
                      ${file.ip_address ? `<div class="text-xs text-gray-400">IP: ${file.ip_address}</div>` : ''}
                    </td>
                    <td class="px-6 py-4">
                      ${file.downloaded_at
                        ? badge({ text: 'ダウンロード済み', variant: 'success' })
                        : badge({ text: '未ダウンロード', variant: 'warning' })
                      }
                    </td>
                    <td class="px-6 py-4 text-right">
                      <a href="/api/received-files/${file.id}/download" class="text-primary-500 hover:text-primary-600 font-medium text-sm">
                        ダウンロード
                      </a>
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
      function copyUrl(token) {
        const url = '${baseUrl}/r/' + token;
        navigator.clipboard.writeText(url).then(() => {
          showToast('リンクをコピーしました', 'success');
        });
      }

      async function disableLink(linkId) {
        if (!confirm('この受信リンクを無効化しますか？')) {
          return;
        }

        try {
          const res = await fetch('/api/receive-links/' + linkId, { method: 'DELETE' });
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
    </script>
  `;

  return c.html(layout({ title: link.title || '受信リンク詳細', user }, content));
});

/**
 * リンクアイテムをレンダリング
 */
function renderLinkItem(
  link: ReceiveLink & { file_count: number; is_active: boolean },
  _baseUrl: string
): string {
  return `
    <div class="px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex-1 min-w-0">
          <div class="flex items-center space-x-3">
            <a href="/receive/${link.id}" class="text-sm font-medium text-gray-900 hover:text-primary-500">
              ${link.title ? escapeHtml(link.title) : `受信リンク #${link.id}`}
            </a>
            ${link.is_active ? badge({ text: '有効', variant: 'success' }) : badge({ text: '無効', variant: 'default' })}
            ${link.password_hash ? badge({ text: 'パスワード', variant: 'info' }) : ''}
          </div>
          <div class="mt-1 flex items-center space-x-4 text-sm text-gray-500">
            <span>受信: ${link.file_count}件</span>
            <span>•</span>
            <span>期限: ${formatDateTime(link.expires_at)}</span>
          </div>
        </div>
        <div class="flex items-center space-x-2 ml-4">
          <a href="/receive/${link.id}" class="text-gray-500 hover:text-gray-700 p-2" title="詳細">
            ${icons.eye}
          </a>
          ${link.is_active ? `
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

export default receive;
