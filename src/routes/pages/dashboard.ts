/**
 * ダッシュボードページ
 * 統計情報と最近のアクティビティを表示
 */

import { Hono } from 'hono';
import type { Env, Variables, Language } from '../../types';
import { layout, formatFileSize, formatRelativeTime } from '../../templates/layout';
import { statCard, icons } from '../../templates/components/card';
import { linkButton } from '../../templates/components/button';
import { getUserStats, getRecentActivity, getSystemUsageStats } from '../../services/d1';
import { createTranslator } from '../../i18n';
import { estimateCosts, formatCost } from '../../services/costs';

const dashboard = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /
 * ダッシュボード画面
 */
dashboard.get('/', async (c) => {
  const user = c.get('user');
  const userId = c.get('userId');
  const lang = c.get('lang') || 'ja';
  const { get } = createTranslator(lang);

  // 統計情報を取得
  const stats = await getUserStats(c.env.DB, userId);

  // 最近のアクティビティを取得
  const activities = await getRecentActivity(c.env.DB, userId);

  // コスト見積もり用の使用量を取得
  const usage = await getSystemUsageStats(c.env.DB);
  const estimatedApiRequests =
    usage.uploadsThisMonth * 3 +
    usage.downloadsThisMonth * 2 +
    usage.fileCount * 2;
  const costEstimate = estimateCosts({
    totalStorageBytes: usage.totalStorageBytes,
    fileCount: usage.fileCount,
    uploadsThisMonth: usage.uploadsThisMonth,
    downloadsThisMonth: usage.downloadsThisMonth,
    apiRequestsThisMonth: estimatedApiRequests,
    estimatedRowsRead: estimatedApiRequests * 10,
    estimatedRowsWritten: usage.uploadsThisMonth * 5,
  });

  const content = `
    <div class="space-y-8">
      <!-- ページヘッダー -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">${get('dashboard.title')}</h1>
          <p class="text-gray-600">${get('dashboard.welcome')}, ${user.name || user.email}</p>
        </div>
        ${linkButton({ text: get('dashboard.uploadNewFile'), href: '/upload', variant: 'primary', icon: icons.upload })}
      </div>

      <!-- 統計カード -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        ${statCard({ label: get('dashboard.stats.totalFiles'), value: stats.total_files, icon: icons.file })}
        ${statCard({ label: get('dashboard.stats.activeLinks'), value: formatFileSize(stats.total_size), icon: icons.storage })}
        ${statCard({ label: get('dashboard.stats.activeLinks'), value: stats.active_links, icon: icons.link })}
        ${statCard({ label: get('dashboard.stats.totalDownloads'), value: stats.total_downloads, icon: icons.download })}
      </div>

      <!-- コスト見積もりサマリー -->
      <a href="/costs" class="block">
        <div class="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl p-6 text-white hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-primary-100 text-sm">${lang === 'ja' ? '今月の予想コスト' : 'Estimated Monthly Cost'}</p>
              <p class="text-3xl font-bold mt-1">${formatCost(costEstimate.totalMonthly)}</p>
              <p class="text-primary-200 text-sm mt-1">≈ ${formatCost(costEstimate.totalMonthly, 'JPY')}</p>
            </div>
            <div class="text-right">
              <div class="inline-flex items-center px-3 py-1 rounded-full ${costEstimate.totalMonthly === 0 ? 'bg-green-400/20 text-green-100' : 'bg-yellow-400/20 text-yellow-100'} text-sm">
                ${costEstimate.totalMonthly === 0 ? (lang === 'ja' ? '無料枠内' : 'Within Free Tier') : (lang === 'ja' ? '詳細を見る →' : 'View Details →')}
              </div>
            </div>
          </div>
          <div class="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p class="text-primary-200">R2</p>
              <p class="font-semibold">${formatCost(costEstimate.r2.total)}</p>
            </div>
            <div>
              <p class="text-primary-200">D1</p>
              <p class="font-semibold">${formatCost(costEstimate.d1.total)}</p>
            </div>
            <div>
              <p class="text-primary-200">Workers</p>
              <p class="font-semibold">${formatCost(costEstimate.workers.total)}</p>
            </div>
          </div>
        </div>
      </a>

      <!-- 最近のアクティビティ -->
      <div class="bg-white rounded-lg shadow-sm border">
        <div class="px-6 py-4 border-b">
          <h2 class="text-lg font-semibold text-gray-900">${get('dashboard.recentActivity')}</h2>
        </div>
        <div class="divide-y">
          ${activities.length === 0 ? `
            <div class="px-6 py-12 text-center text-gray-500">
              ${get('common.noData')}
            </div>
          ` : activities.map((a) => renderActivityItem(a, lang)).join('')}
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
              <h3 class="font-medium text-gray-900">${get('dashboard.uploadNewFile')}</h3>
              <p class="text-sm text-gray-500">${lang === 'ja' ? '新しいファイルを共有' : 'Share new files'}</p>
            </div>
          </div>
        </a>
        <a href="/files" class="block p-6 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
          <div class="flex items-center space-x-4">
            <div class="p-3 bg-primary-100 rounded-lg">
              ${icons.file}
            </div>
            <div>
              <h3 class="font-medium text-gray-900">${get('nav.files')}</h3>
              <p class="text-sm text-gray-500">${lang === 'ja' ? 'アップロード済みファイルを管理' : 'Manage uploaded files'}</p>
            </div>
          </div>
        </a>
        <a href="/receive" class="block p-6 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
          <div class="flex items-center space-x-4">
            <div class="p-3 bg-green-100 rounded-lg">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
            </div>
            <div>
              <h3 class="font-medium text-gray-900">${get('dashboard.createReceiveLink')}</h3>
              <p class="text-sm text-gray-500">${lang === 'ja' ? 'ゲストからファイルを受け取る' : 'Receive files from guests'}</p>
            </div>
          </div>
        </a>
      </div>
    </div>

    <!-- ローカル時刻表示スクリプト -->
    <script>
      (function() {
        // ブラウザのタイムゾーンで正確な時刻を表示
        function formatLocalTime(isoString, locale) {
          const date = new Date(isoString);
          const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          };
          return new Intl.DateTimeFormat(locale, options).format(date);
        }

        // 相対時間を計算（ツールチップ用）
        function formatRelativeTime(isoString, locale) {
          const date = new Date(isoString);
          const now = new Date();
          const diffMs = now.getTime() - date.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMins / 60);
          const diffDays = Math.floor(diffHours / 24);

          if (locale === 'ja') {
            if (diffMins < 1) return 'たった今';
            if (diffMins < 60) return diffMins + '分前';
            if (diffHours < 24) return diffHours + '時間前';
            if (diffDays < 7) return diffDays + '日前';
            return diffDays + '日前';
          } else {
            if (diffMins < 1) return 'just now';
            if (diffMins < 60) return diffMins + ' min ago';
            if (diffHours < 24) return diffHours + ' hours ago';
            if (diffDays < 7) return diffDays + ' days ago';
            return diffDays + ' days ago';
          }
        }

        // ページ読み込み時に時刻を変換
        document.addEventListener('DOMContentLoaded', function() {
          const locale = document.documentElement.lang || 'ja';
          const timeElements = document.querySelectorAll('.local-time');

          timeElements.forEach(function(el) {
            const isoString = el.getAttribute('datetime');
            if (isoString) {
              // 正確な時刻を表示
              el.textContent = formatLocalTime(isoString, locale);
              // 相対時間をツールチップに設定
              el.title = formatRelativeTime(isoString, locale);
            }
          });
        });
      })();
    </script>
  `;

  return c.html(layout({ title: get('dashboard.title'), user, lang }, content));
});

/**
 * アクティビティアイテムをレンダリング
 */
function renderActivityItem(
  activity: {
    type: 'upload' | 'download' | 'link_created';
    file_name: string;
    created_at: string;
    details?: string | null;
  },
  lang: Language
): string {
  const typeLabelsJa = {
    upload: { label: 'アップロード', color: 'bg-blue-100 text-blue-600' },
    download: { label: 'ダウンロード', color: 'bg-green-100 text-green-600' },
    link_created: { label: 'リンク作成', color: 'bg-purple-100 text-purple-600' },
  };

  const typeLabelsEn = {
    upload: { label: 'Upload', color: 'bg-blue-100 text-blue-600' },
    download: { label: 'Download', color: 'bg-green-100 text-green-600' },
    link_created: { label: 'Link Created', color: 'bg-purple-100 text-purple-600' },
  };

  const typeLabels = lang === 'ja' ? typeLabelsJa : typeLabelsEn;
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
      <time class="text-sm text-gray-500 local-time" datetime="${activity.created_at}" title="${formatRelativeTime(activity.created_at)}"></time>
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
