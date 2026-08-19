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
import { createTranslator } from '../../i18n';
import { getAuthMethod_forTemplate } from '../../middleware/auth';

const costs = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /costs
 * コスト見積もりダッシュボード
 */
costs.get('/', async (c) => {
  const user = c.get('user');
  const lang = c.get('lang') || 'ja';
  const { get } = createTranslator(lang);

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
        <h1 class="text-2xl font-bold text-gray-900">${get('costs.title')}</h1>
        <p class="text-gray-600">${get('costs.description')}</p>
      </div>

      <!-- 総コストサマリー -->
      <div class="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl p-6 text-white">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-primary-100 text-sm">${get('costs.estimatedCost')}</p>
            <p class="text-4xl font-bold mt-1">${formatCost(estimate.totalMonthly)}</p>
            <p class="text-primary-200 text-sm mt-1">≈ ${formatCost(estimate.totalMonthly, 'JPY')}</p>
          </div>
          <div class="text-right">
            <p class="text-primary-100 text-sm">${get('costs.withinFree')}</p>
            <p class="text-2xl font-semibold">${estimate.totalMonthly === 0 ? '✓' : get('costs.partialExcess')}</p>
          </div>
        </div>
      </div>

      <!-- サービス別コスト -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        ${renderServiceCard(get('costs.r2Storage'), estimate.r2, [
          { label: get('costs.storage'), usage: formatFileSize(estimate.r2.storage.usage * 1024 * 1024 * 1024), free: formatFileSize(estimate.r2.storage.free * 1024 * 1024 * 1024), cost: estimate.r2.storage.cost },
          { label: get('costs.classAWrite'), usage: formatNumber(estimate.r2.classA.usage), free: formatNumber(estimate.r2.classA.free), cost: estimate.r2.classA.cost },
          { label: get('costs.classBRead'), usage: formatNumber(estimate.r2.classB.usage), free: formatNumber(estimate.r2.classB.free), cost: estimate.r2.classB.cost },
        ], get('costs.freeAllowance'), get('costs.withinFreeQuota'))}

        ${renderServiceCard(get('costs.d1Database'), estimate.d1, [
          { label: get('costs.storage'), usage: formatFileSize(estimate.d1.storage.usage * 1024 * 1024 * 1024), free: formatFileSize(estimate.d1.storage.free * 1024 * 1024 * 1024), cost: estimate.d1.storage.cost },
          { label: get('costs.rowsRead'), usage: formatNumber(estimate.d1.rowsRead.usage), free: formatNumber(estimate.d1.rowsRead.free), cost: estimate.d1.rowsRead.cost },
          { label: get('costs.rowsWrite'), usage: formatNumber(estimate.d1.rowsWritten.usage), free: formatNumber(estimate.d1.rowsWritten.free), cost: estimate.d1.rowsWritten.cost },
        ], get('costs.freeAllowance'), get('costs.withinFreeQuota'))}

        ${renderServiceCard(get('costs.workers'), estimate.workers, [
          { label: get('costs.requests'), usage: formatNumber(estimate.workers.requests.usage), free: formatNumber(estimate.workers.requests.free) + get('costs.perMonth'), cost: estimate.workers.requests.cost },
        ], get('costs.freeAllowance'), get('costs.withinFreeQuota'))}
      </div>

      <!-- 使用量詳細 -->
      <div class="bg-white rounded-lg shadow-sm border">
        <div class="px-6 py-4 border-b">
          <h2 class="text-lg font-semibold text-gray-900">${get('costs.usageDetails')}</h2>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
            ${renderUsageStat(get('costs.totalStorage'), formatFileSize(usage.totalStorageBytes))}
            ${renderUsageStat(get('costs.fileCount'), usage.fileCount.toString())}
            ${renderUsageStat(get('costs.uploadsThisMonth'), usage.uploadsThisMonth.toString())}
            ${renderUsageStat(get('costs.downloadsThisMonth'), usage.downloadsThisMonth.toString())}
          </div>
        </div>
      </div>

      <!-- 料金表 -->
      <div class="bg-white rounded-lg shadow-sm border">
        <div class="px-6 py-4 border-b">
          <h2 class="text-lg font-semibold text-gray-900">${get('costs.pricingTable')}</h2>
        </div>
        <div class="p-6">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b">
                  <th class="text-left py-2 font-medium text-gray-700">${get('costs.service')}</th>
                  <th class="text-left py-2 font-medium text-gray-700">${get('costs.item')}</th>
                  <th class="text-right py-2 font-medium text-gray-700">${get('costs.freeTier')}</th>
                  <th class="text-right py-2 font-medium text-gray-700">${get('costs.overage')}</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr>
                  <td class="py-2 text-gray-900 font-medium" rowspan="4">R2</td>
                  <td class="py-2 text-gray-600">${get('costs.storageStandard')}</td>
                  <td class="py-2 text-right text-gray-600">10 GB${get('costs.perMonth')}</td>
                  <td class="py-2 text-right text-gray-900">$0.015/GB-month</td>
                </tr>
                <tr>
                  <td class="py-2 text-gray-600">${get('costs.storageInfrequent')}</td>
                  <td class="py-2 text-right text-gray-600">-</td>
                  <td class="py-2 text-right text-gray-900">$0.01/GB-month</td>
                </tr>
                <tr>
                  <td class="py-2 text-gray-600">${get('costs.classAOps')}</td>
                  <td class="py-2 text-right text-gray-600">1M${get('costs.perMonth')}</td>
                  <td class="py-2 text-right text-gray-900">$4.50/1M</td>
                </tr>
                <tr>
                  <td class="py-2 text-gray-600">${get('costs.classBOps')}</td>
                  <td class="py-2 text-right text-gray-600">10M${get('costs.perMonth')}</td>
                  <td class="py-2 text-right text-gray-900">$0.36/1M</td>
                </tr>
                <tr>
                  <td class="py-2 text-gray-900 font-medium" rowspan="3">D1</td>
                  <td class="py-2 text-gray-600">${get('costs.storage')}</td>
                  <td class="py-2 text-right text-gray-600">5 GB</td>
                  <td class="py-2 text-right text-gray-900">$0.75/GB-month</td>
                </tr>
                <tr>
                  <td class="py-2 text-gray-600">${get('costs.rowsRead')}</td>
                  <td class="py-2 text-right text-gray-600">25B${get('costs.perMonth')}</td>
                  <td class="py-2 text-right text-gray-900">$0.001/1M</td>
                </tr>
                <tr>
                  <td class="py-2 text-gray-600">${get('costs.rowsWrite')}</td>
                  <td class="py-2 text-right text-gray-600">50M${get('costs.perMonth')}</td>
                  <td class="py-2 text-right text-gray-900">$1.00/1M</td>
                </tr>
                <tr>
                  <td class="py-2 text-gray-900 font-medium" rowspan="3">Workers</td>
                  <td class="py-2 text-gray-600">${get('costs.baseFee')}</td>
                  <td class="py-2 text-right text-gray-600">-</td>
                  <td class="py-2 text-right text-gray-900">$5${get('costs.perMonth')}</td>
                </tr>
                <tr>
                  <td class="py-2 text-gray-600">${get('costs.requests')}</td>
                  <td class="py-2 text-right text-gray-600">10M${get('costs.perMonth')}</td>
                  <td class="py-2 text-right text-gray-900">$0.30/1M</td>
                </tr>
                <tr>
                  <td class="py-2 text-gray-600">${get('costs.cpuTime')}</td>
                  <td class="py-2 text-right text-gray-600">30M ms${get('costs.perMonth')}</td>
                  <td class="py-2 text-right text-gray-900">$0.02/1M ms</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 特記事項 -->
          <div class="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 class="font-medium text-gray-900 mb-2">${get('costs.notes')}</h4>
            <ul class="text-xs text-gray-600 space-y-1">
              <li>• ${get('costs.noteR2Egress')}</li>
              <li>• ${get('costs.noteD1ScaleZero')}</li>
              <li>• ${get('costs.noteWorkersFree')}</li>
              <li>• ${get('costs.noteD1Free')}</li>
            </ul>
          </div>

          <p class="mt-4 text-xs text-gray-500">
            ※ ${get('costs.pricingNote')}
            <a href="https://developers.cloudflare.com/r2/pricing/" target="_blank" class="text-primary-600 hover:underline">R2</a>,
            <a href="https://developers.cloudflare.com/d1/platform/pricing/" target="_blank" class="text-primary-600 hover:underline">D1</a>,
            <a href="https://developers.cloudflare.com/workers/platform/pricing/" target="_blank" class="text-primary-600 hover:underline">Workers</a>
          </p>
        </div>
      </div>
    </div>
  `;

  return c.html(layout({ title: get('nav.costs'), user, lang, authMethod: getAuthMethod_forTemplate(c.env), currentUrl: c.req.url }, content));
});

/**
 * サービスカードをレンダリング
 */
function renderServiceCard(
  title: string,
  data: { total: number },
  items: Array<{ label: string; usage: string; free: string; cost: number }>,
  freeAllowanceLabel: string,
  withinFreeLabel: string
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
                  : `<span class="text-green-600">${withinFreeLabel}</span>`
              }
            </div>
          </div>
          <div class="text-xs text-gray-400">${freeAllowanceLabel}: ${item.free}</div>
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
