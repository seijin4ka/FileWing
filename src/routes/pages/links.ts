/**
 * リンク管理ページ
 * すべてのダウンロードリンクを一覧・管理
 */

import { Hono } from 'hono';
import type { Env, Variables, DownloadLink } from '../../types';
import { layout, formatFileSize, localDateTime, escapeHtml } from '../../templates/layout';
import { linkButton } from '../../templates/components/button';
import { badge } from '../../templates/components/table';
import { icons } from '../../templates/components/card';
import { getLinksByUser } from '../../services/d1';
import { createTranslator } from '../../i18n';

const links = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /links
 * リンク一覧画面
 */
links.get('/', async (c) => {
  const user = c.get('user');
  const userId = c.get('userId');
  const lang = c.get('lang') || 'ja';
  const { get } = createTranslator(lang);

  // リンク一覧を取得
  const linkList = await getLinksByUser(c.env.DB, userId);
  const baseUrl = new URL(c.req.url).origin;

  // 統計情報を計算
  const activeLinks = linkList.filter(
    (link) => !link.disabled_at && new Date(link.expires_at) > new Date()
  );
  const totalDownloads = linkList.reduce((sum, l) => sum + l.download_count, 0);

  const content = `
    <div class="space-y-6">
      <!-- ページヘッダー -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">${get('links.title')}</h1>
          <p class="text-gray-600">${get('links.pageDescription')}</p>
        </div>
        ${linkButton({ text: get('common.upload'), href: '/upload', variant: 'primary', icon: icons.upload })}
      </div>

      <!-- 統計カード -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white rounded-lg shadow-sm border p-4">
          <p class="text-sm text-gray-500">${lang === 'ja' ? '総リンク数' : 'Total Links'}</p>
          <p class="text-2xl font-bold text-gray-900">${linkList.length}</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border p-4">
          <p class="text-sm text-gray-500">${lang === 'ja' ? '有効なリンク' : 'Active Links'}</p>
          <p class="text-2xl font-bold text-green-600">${activeLinks.length}</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border p-4">
          <p class="text-sm text-gray-500">${lang === 'ja' ? '総ダウンロード数' : 'Total Downloads'}</p>
          <p class="text-2xl font-bold text-primary-600">${totalDownloads}</p>
        </div>
      </div>

      <!-- リンク一覧 -->
      <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
        ${linkList.length === 0 ? `
          <div class="px-6 py-12 text-center">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
            </svg>
            <h3 class="mt-4 text-lg font-medium text-gray-900">${get('links.noLinks')}</h3>
            <p class="mt-2 text-gray-500">${get('links.noLinksDesc')}</p>
            <div class="mt-6">
              ${linkButton({ text: get('common.upload'), href: '/upload', variant: 'primary' })}
            </div>
          </div>
        ` : `
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${get('links.file')}</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${get('links.status')}</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${get('links.downloads')}</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${get('links.expiresAt')}</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${get('links.created')}</th>
                  <th scope="col" class="relative px-6 py-3"><span class="sr-only">${get('files.actions')}</span></th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                ${linkList.map((link) => renderLinkRow(link, get)).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>

    <!-- リンク詳細モーダル -->
    <div id="link-modal" class="hidden fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="px-6 py-4 border-b flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900">${get('links.details')}</h3>
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
      const baseUrl = '${baseUrl}';
      const i18n = {
        linkCopied: '${get('links.linkCopied')}',
        disableConfirm: '${get('links.disableConfirm')}',
        linkDisabled: '${get('links.linkDisabled')}',
        disableFailed: '${get('links.disableFailed')}',
        error: '${get('common.error')}',
        totalDownloads: '${get('links.totalDownloads')}',
        uniqueIps: '${get('links.uniqueIps')}',
        recipients: '${get('links.recipients')}',
        recentDownloads: '${get('links.recentDownloads')}',
        noDownloadsYet: '${get('links.noDownloadsYet')}',
        dateTime: '${get('links.dateTime')}',
        ipAddress: '${get('links.ipAddress')}',
        userAgent: '${get('links.userAgent')}',
      };

      // URLをコピー
      function copyUrl(token) {
        const url = baseUrl + '/d/' + token;
        navigator.clipboard.writeText(url).then(() => {
          showToast(i18n.linkCopied, 'success');
        });
      }

      // リンク無効化
      async function disableLink(linkId) {
        if (!confirm(i18n.disableConfirm)) {
          return;
        }

        try {
          const res = await fetch('/api/links/' + linkId, { method: 'DELETE' });
          const result = await res.json();

          if (result.success) {
            showToast(i18n.linkDisabled, 'success');
            location.reload();
          } else {
            showToast(result.error || i18n.disableFailed, 'error');
          }
        } catch (error) {
          showToast(i18n.error, 'error');
        }
      }

      // リンク詳細を表示
      async function showLinkDetails(linkId) {
        try {
          const res = await fetch('/api/links/' + linkId + '/stats');
          const result = await res.json();

          if (!result.success) {
            showToast(result.error || i18n.error, 'error');
            return;
          }

          const stats = result.stats;
          const modalContent = document.getElementById('modal-content');
          modalContent.innerHTML = \`
            <div class="space-y-6">
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-gray-50 rounded-lg p-4">
                  <p class="text-sm text-gray-500">\${i18n.totalDownloads}</p>
                  <p class="text-2xl font-bold text-gray-900">\${stats.total_downloads}</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-4">
                  <p class="text-sm text-gray-500">\${i18n.uniqueIps}</p>
                  <p class="text-2xl font-bold text-gray-900">\${stats.unique_ips}</p>
                </div>
              </div>

              \${stats.recipients.length > 0 ? \`
                <div>
                  <h4 class="text-sm font-medium text-gray-900 mb-2">\${i18n.recipients}</h4>
                  <div class="space-y-1">
                    \${stats.recipients.map(r => \`
                      <div class="text-sm text-gray-600">\${escHtml(r.email)} <span class="text-gray-400">(\${formatDate(r.sent_at)})</span></div>
                    \`).join('')}
                  </div>
                </div>
              \` : ''}

              \${stats.recent_logs.length > 0 ? \`
                <div>
                  <h4 class="text-sm font-medium text-gray-900 mb-2">\${i18n.recentDownloads}</h4>
                  <div class="overflow-x-auto">
                    <table class="min-w-full text-sm">
                      <thead>
                        <tr class="border-b">
                          <th class="text-left py-2">\${i18n.dateTime}</th>
                          <th class="text-left py-2">\${i18n.ipAddress}</th>
                          <th class="text-left py-2">\${i18n.userAgent}</th>
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
              \` : '<p class="text-gray-500 text-center">' + i18n.noDownloadsYet + '</p>'}
            </div>
          \`;

          document.getElementById('link-modal').classList.remove('hidden');
        } catch (error) {
          showToast(i18n.error, 'error');
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
    </script>
  `;

  return c.html(layout({ title: get('links.title'), user, lang, currentUrl: c.req.url }, content));
});

/**
 * リンク行をレンダリング
 */
function renderLinkRow(
  link: DownloadLink & { file_name: string; file_size: number },
  get: (key: string) => string
): string {
  const isExpired = new Date(link.expires_at) < new Date();
  const isDisabled = !!link.disabled_at;
  const isActive = !isExpired && !isDisabled;
  const hasReachedLimit =
    link.max_downloads !== null && link.download_count >= link.max_downloads;

  let status: { text: string; variant: 'success' | 'warning' | 'error' | 'info' | 'default' };
  if (isDisabled) {
    status = { text: get('links.disabled'), variant: 'default' };
  } else if (isExpired) {
    status = { text: get('links.expired'), variant: 'error' };
  } else if (hasReachedLimit) {
    status = { text: get('links.dlLimit'), variant: 'warning' };
  } else {
    status = { text: get('links.active'), variant: 'success' };
  }

  return `
    <tr class="hover:bg-gray-50">
      <td class="px-6 py-4">
        <div class="flex items-center">
          <div class="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <div class="ml-4">
            <div class="text-sm font-medium text-gray-900">
              <a href="/files/${link.file_id}" class="hover:text-primary-600">${escapeHtml(link.file_name)}</a>
            </div>
            <div class="text-sm text-gray-500">${formatFileSize(link.file_size)}</div>
          </div>
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="flex items-center space-x-2">
          ${badge(status)}
          ${link.password_hash ? badge({ text: get('links.hasPassword'), variant: 'info' }) : ''}
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${link.download_count}${link.max_downloads ? `/${link.max_downloads}` : ''}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${localDateTime(link.expires_at)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${localDateTime(link.created_at)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div class="flex items-center justify-end space-x-2">
          <button type="button" onclick="showLinkDetails(${link.id})" class="text-gray-500 hover:text-gray-700 p-1" title="${get('links.details')}">
            ${icons.eye}
          </button>
          ${isActive ? `
            <button type="button" onclick="copyUrl('${link.token}')" class="text-gray-500 hover:text-gray-700 p-1" title="${get('links.copyLink')}">
              ${icons.copy}
            </button>
            <button type="button" onclick="disableLink(${link.id})" class="text-red-500 hover:text-red-700 p-1" title="${get('links.disableLink')}">
              ${icons.trash}
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `;
}

export default links;
