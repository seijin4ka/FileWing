/**
 * ダッシュボードページ
 * 統計情報と最近のアクティビティを表示
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';
import { layout, formatFileSize, formatRelativeTime } from '../../templates/layout';
import { statCard, icons } from '../../templates/components/card';
import { linkButton } from '../../templates/components/button';
import { getUserStats, getRecentActivity } from '../../services/d1';

const dashboard = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /
 * ダッシュボード画面
 */
dashboard.get('/', async (c) => {
  const user = c.get('user');
  const userId = c.get('userId');

  // 統計情報を取得
  const stats = await getUserStats(c.env.DB, userId);

  // 最近のアクティビティを取得
  const activities = await getRecentActivity(c.env.DB, userId);

  const content = `
    <div class="space-y-8">
      <!-- ページヘッダー -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">ダッシュボード</h1>
          <p class="text-gray-600">ようこそ、${user.name || user.email} さん</p>
        </div>
        ${linkButton({ text: 'ファイルをアップロード', href: '/upload', variant: 'primary', icon: icons.upload })}
      </div>

      <!-- 統計カード -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        ${statCard({ label: 'ファイル数', value: stats.total_files, icon: icons.file })}
        ${statCard({ label: 'ストレージ使用量', value: formatFileSize(stats.total_size), icon: icons.storage })}
        ${statCard({ label: '有効なリンク', value: stats.active_links, icon: icons.link })}
        ${statCard({ label: '総ダウンロード数', value: stats.total_downloads, icon: icons.download })}
      </div>

      <!-- 最近のアクティビティ -->
      <div class="bg-white rounded-lg shadow-sm border">
        <div class="px-6 py-4 border-b">
          <h2 class="text-lg font-semibold text-gray-900">最近のアクティビティ</h2>
        </div>
        <div class="divide-y">
          ${activities.length === 0 ? `
            <div class="px-6 py-12 text-center text-gray-500">
              まだアクティビティはありません
            </div>
          ` : activities.map(renderActivityItem).join('')}
        </div>
      </div>

      <!-- クイックアクション -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <a href="/upload" class="block p-6 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
          <div class="flex items-center space-x-4">
            <div class="p-3 bg-primary-100 rounded-lg">
              ${icons.upload}
            </div>
            <div>
              <h3 class="font-medium text-gray-900">ファイルをアップロード</h3>
              <p class="text-sm text-gray-500">新しいファイルを共有</p>
            </div>
          </div>
        </a>
        <a href="/files" class="block p-6 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
          <div class="flex items-center space-x-4">
            <div class="p-3 bg-primary-100 rounded-lg">
              ${icons.file}
            </div>
            <div>
              <h3 class="font-medium text-gray-900">ファイル一覧</h3>
              <p class="text-sm text-gray-500">アップロード済みファイルを管理</p>
            </div>
          </div>
        </a>
        <div class="block p-6 bg-white rounded-lg shadow-sm border">
          <div class="flex items-center space-x-4">
            <div class="p-3 bg-green-100 rounded-lg">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
            </div>
            <div>
              <h3 class="font-medium text-gray-900">セキュア共有</h3>
              <p class="text-sm text-gray-500">パスワード・期限付きリンク</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  return c.html(layout({ title: 'ダッシュボード', user }, content));
});

/**
 * アクティビティアイテムをレンダリング
 */
function renderActivityItem(activity: {
  type: 'upload' | 'download' | 'link_created';
  file_name: string;
  created_at: string;
  details?: string | null;
}): string {
  const typeLabels = {
    upload: { label: 'アップロード', color: 'bg-blue-100 text-blue-600' },
    download: { label: 'ダウンロード', color: 'bg-green-100 text-green-600' },
    link_created: { label: 'リンク作成', color: 'bg-purple-100 text-purple-600' },
  };

  const { label, color } = typeLabels[activity.type];

  return `
    <div class="px-6 py-4 flex items-center justify-between">
      <div class="flex items-center space-x-4">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}">
          ${label}
        </span>
        <div>
          <p class="text-sm font-medium text-gray-900">${escapeHtml(activity.file_name)}</p>
          ${activity.details ? `<p class="text-xs text-gray-500">IP: ${escapeHtml(activity.details)}</p>` : ''}
        </div>
      </div>
      <span class="text-sm text-gray-500">${formatRelativeTime(activity.created_at)}</span>
    </div>
  `;
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default dashboard;
