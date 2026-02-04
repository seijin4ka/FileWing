/**
 * コスト見積もりページ
 * Cloudflareサービスの使用量とコストを表示
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';
import { layout, formatFileSize } from '../../templates/layout';
import { getSystemUsageStats } from '../../services/d1';
import {
  estimateCosts,
  formatCost,
  formatNumber,
} from '../../services/costs';

const costs = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /costs
 * コスト見積もりダッシュボード
 */
costs.get('/', async (c) => {
  const user = c.get('user');

  // システム全体の使用量を取得
  const usage = await getSystemUsageStats(c.env.DB);

  // APIリクエスト数を推定（アップロード + ダウンロード + その他のAPI呼び出し）
  const estimatedApiRequests =
    usage.uploadsThisMonth * 3 + // アップロード = ファイル + リンク作成 + etc
    usage.downloadsThisMonth * 2 + // ダウンロード = 認証 + ファイル取得
    usage.fileCount * 2; // ファイル一覧表示など

  // コストを計算
  const estimate = estimateCosts({
    totalStorageBytes: usage.totalStorageBytes,
    fileCount: usage.fileCount,
    uploadsThisMonth: usage.uploadsThisMonth,
    downloadsThisMonth: usage.downloadsThisMonth,
    apiRequestsThisMonth: estimatedApiRequests,
    estimatedRowsRead: estimatedApiRequests * 10, // 1リクエストあたり約10行読み取りと推定
    estimatedRowsWritten: usage.uploadsThisMonth * 5, // アップロード時に約5行書き込みと推定
  });

  const content = `
    <div class="space-y-8">
      <!-- ページヘッダー -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900">コスト見積もり</h1>
        <p class="text-gray-600">Cloudflareサービスの使用量と予想コスト</p>
      </div>

      <!-- 総コストサマリー -->
      <div class="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl p-6 text-white">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-primary-100 text-sm">今月の予想コスト</p>
            <p class="text-4xl font-bold mt-1">${formatCost(estimate.totalMonthly)}</p>
            <p class="text-primary-200 text-sm mt-1">≈ ${formatCost(estimate.totalMonthly, 'JPY')}</p>
          </div>
          <div class="text-right">
            <p class="text-primary-100 text-sm">無料枠内</p>
            <p class="text-2xl font-semibold">${estimate.totalMonthly === 0 ? '✓' : '一部超過'}</p>
          </div>
        </div>
      </div>

      <!-- サービス別コスト -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        ${renderServiceCard('R2 ストレージ', estimate.r2, [
          { label: 'ストレージ', usage: formatFileSize(estimate.r2.storage.usage * 1024 * 1024 * 1024), free: formatFileSize(estimate.r2.storage.free * 1024 * 1024 * 1024), cost: estimate.r2.storage.cost },
          { label: 'Class A (書込)', usage: formatNumber(estimate.r2.classA.usage), free: formatNumber(estimate.r2.classA.free), cost: estimate.r2.classA.cost },
          { label: 'Class B (読取)', usage: formatNumber(estimate.r2.classB.usage), free: formatNumber(estimate.r2.classB.free), cost: estimate.r2.classB.cost },
        ])}

        ${renderServiceCard('D1 データベース', estimate.d1, [
          { label: 'ストレージ', usage: formatFileSize(estimate.d1.storage.usage * 1024 * 1024 * 1024), free: formatFileSize(estimate.d1.storage.free * 1024 * 1024 * 1024), cost: estimate.d1.storage.cost },
          { label: '行読み取り', usage: formatNumber(estimate.d1.rowsRead.usage), free: formatNumber(estimate.d1.rowsRead.free), cost: estimate.d1.rowsRead.cost },
          { label: '行書き込み', usage: formatNumber(estimate.d1.rowsWritten.usage), free: formatNumber(estimate.d1.rowsWritten.free), cost: estimate.d1.rowsWritten.cost },
        ])}

        ${renderServiceCard('Workers', estimate.workers, [
          { label: 'リクエスト', usage: formatNumber(estimate.workers.requests.usage), free: formatNumber(estimate.workers.requests.free) + '/月', cost: estimate.workers.requests.cost },
        ])}
      </div>

      <!-- 使用量詳細 -->
      <div class="bg-white rounded-lg shadow-sm border">
        <div class="px-6 py-4 border-b">
          <h2 class="text-lg font-semibold text-gray-900">使用量詳細</h2>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
            ${renderUsageStat('総ストレージ', formatFileSize(usage.totalStorageBytes))}
            ${renderUsageStat('ファイル数', usage.fileCount.toString())}
            ${renderUsageStat('今月のアップロード', usage.uploadsThisMonth.toString())}
            ${renderUsageStat('今月のダウンロード', usage.downloadsThisMonth.toString())}
          </div>
        </div>
      </div>

      <!-- 料金表 -->
      <div class="bg-white rounded-lg shadow-sm border">
        <div class="px-6 py-4 border-b">
          <h2 class="text-lg font-semibold text-gray-900">Cloudflare料金表（参考）</h2>
        </div>
        <div class="p-6">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b">
                  <th class="text-left py-2 font-medium text-gray-700">サービス</th>
                  <th class="text-left py-2 font-medium text-gray-700">項目</th>
                  <th class="text-right py-2 font-medium text-gray-700">無料枠</th>
                  <th class="text-right py-2 font-medium text-gray-700">超過料金</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr>
                  <td class="py-2 text-gray-900" rowspan="3">R2</td>
                  <td class="py-2 text-gray-600">ストレージ</td>
                  <td class="py-2 text-right text-gray-600">10 GB/月</td>
                  <td class="py-2 text-right text-gray-900">$0.015/GB</td>
                </tr>
                <tr>
                  <td class="py-2 text-gray-600">Class A操作</td>
                  <td class="py-2 text-right text-gray-600">100万/月</td>
                  <td class="py-2 text-right text-gray-900">$4.50/100万</td>
                </tr>
                <tr>
                  <td class="py-2 text-gray-600">Class B操作</td>
                  <td class="py-2 text-right text-gray-600">1000万/月</td>
                  <td class="py-2 text-right text-gray-900">$0.36/100万</td>
                </tr>
                <tr>
                  <td class="py-2 text-gray-900" rowspan="3">D1</td>
                  <td class="py-2 text-gray-600">ストレージ</td>
                  <td class="py-2 text-right text-gray-600">5 GB</td>
                  <td class="py-2 text-right text-gray-900">$0.75/GB</td>
                </tr>
                <tr>
                  <td class="py-2 text-gray-600">行読み取り</td>
                  <td class="py-2 text-right text-gray-600">250億/月</td>
                  <td class="py-2 text-right text-gray-900">$0.001/100万</td>
                </tr>
                <tr>
                  <td class="py-2 text-gray-600">行書き込み</td>
                  <td class="py-2 text-right text-gray-600">5000万/月</td>
                  <td class="py-2 text-right text-gray-900">$1.00/100万</td>
                </tr>
                <tr>
                  <td class="py-2 text-gray-900">Workers</td>
                  <td class="py-2 text-gray-600">リクエスト</td>
                  <td class="py-2 text-right text-gray-600">10万/日</td>
                  <td class="py-2 text-right text-gray-900">$0.30/100万</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="mt-4 text-xs text-gray-500">
            ※ 料金は2024年時点の情報です。最新の料金は
            <a href="https://developers.cloudflare.com/r2/pricing/" target="_blank" class="text-primary-600 hover:underline">Cloudflare公式ドキュメント</a>
            をご確認ください。
          </p>
        </div>
      </div>
    </div>
  `;

  return c.html(layout({ title: 'コスト見積もり', user }, content));
});

/**
 * サービスカードをレンダリング
 */
function renderServiceCard(
  title: string,
  data: { total: number },
  items: Array<{ label: string; usage: string; free: string; cost: number }>
): string {
  return `
    <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div class="px-4 py-3 border-b bg-gray-50">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-gray-900">${title}</h3>
          <span class="text-lg font-bold ${data.total > 0 ? 'text-primary-600' : 'text-green-600'}">
            ${formatCost(data.total)}
          </span>
        </div>
      </div>
      <div class="p-4 space-y-3">
        ${items
          .map(
            (item) => `
          <div class="flex items-center justify-between text-sm">
            <div>
              <span class="text-gray-700">${item.label}</span>
              <span class="text-gray-400 mx-1">|</span>
              <span class="text-gray-500">${item.usage}</span>
            </div>
            <div class="text-right">
              ${
                item.cost > 0
                  ? `<span class="text-primary-600">${formatCost(item.cost)}</span>`
                  : `<span class="text-green-600">無料枠内</span>`
              }
            </div>
          </div>
          <div class="text-xs text-gray-400">無料枠: ${item.free}</div>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

/**
 * 使用量統計をレンダリング
 */
function renderUsageStat(label: string, value: string): string {
  return `
    <div class="text-center">
      <p class="text-2xl font-bold text-gray-900">${value}</p>
      <p class="text-sm text-gray-500">${label}</p>
    </div>
  `;
}

export default costs;
