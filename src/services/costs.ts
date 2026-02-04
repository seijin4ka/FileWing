/**
 * コスト見積もりサービス
 * Cloudflareの料金体系に基づいてコストを計算
 */

/**
 * Cloudflare料金体系（2024年時点）
 * https://developers.cloudflare.com/r2/pricing/
 * https://developers.cloudflare.com/d1/pricing/
 * https://developers.cloudflare.com/workers/platform/pricing/
 */
export const PRICING = {
  // R2ストレージ
  r2: {
    storage: 0.015, // $0.015/GB/月
    classA: 4.50 / 1_000_000, // $4.50/100万リクエスト（書き込み）
    classB: 0.36 / 1_000_000, // $0.36/100万リクエスト（読み取り）
    freeStorageGB: 10, // 無料枠: 10GB
    freeClassA: 1_000_000, // 無料枠: 100万リクエスト/月
    freeClassB: 10_000_000, // 無料枠: 1000万リクエスト/月
  },
  // D1データベース
  d1: {
    rowsRead: 0.001, // $0.001/100万行読み取り → 実質無料に近い
    rowsWritten: 1.00 / 1_000_000, // $1.00/100万行書き込み
    storageGB: 0.75, // $0.75/GB/月
    freeRowsRead: 25_000_000_000, // 無料枠: 250億行/月
    freeRowsWritten: 50_000_000, // 無料枠: 5000万行/月
    freeStorageGB: 5, // 無料枠: 5GB
  },
  // Workers
  workers: {
    requests: 0.30 / 1_000_000, // $0.30/100万リクエスト（Bundled）
    cpuTime: 0.02 / 1_000_000, // $0.02/100万ms CPU時間
    freeRequests: 100_000, // 無料枠: 10万リクエスト/日
  },
};

/**
 * コスト見積もり結果
 */
export interface CostEstimate {
  r2: {
    storage: { usage: number; cost: number; free: number };
    classA: { usage: number; cost: number; free: number };
    classB: { usage: number; cost: number; free: number };
    total: number;
  };
  d1: {
    storage: { usage: number; cost: number; free: number };
    rowsRead: { usage: number; cost: number; free: number };
    rowsWritten: { usage: number; cost: number; free: number };
    total: number;
  };
  workers: {
    requests: { usage: number; cost: number; free: number };
    total: number;
  };
  totalMonthly: number;
  currency: 'USD';
}

/**
 * 使用量統計
 */
export interface UsageStats {
  // ストレージ
  totalStorageBytes: number;
  fileCount: number;
  // リクエスト（推定）
  uploadsThisMonth: number;
  downloadsThisMonth: number;
  apiRequestsThisMonth: number;
  // D1
  estimatedRowsRead: number;
  estimatedRowsWritten: number;
}

/**
 * 使用量からコストを見積もる
 */
export function estimateCosts(usage: UsageStats): CostEstimate {
  const storageGB = usage.totalStorageBytes / (1024 * 1024 * 1024);

  // R2コスト計算
  const r2StorageCost = Math.max(0, storageGB - PRICING.r2.freeStorageGB) * PRICING.r2.storage;
  const r2ClassAUsage = usage.uploadsThisMonth;
  const r2ClassACost = Math.max(0, r2ClassAUsage - PRICING.r2.freeClassA) * PRICING.r2.classA;
  const r2ClassBUsage = usage.downloadsThisMonth;
  const r2ClassBCost = Math.max(0, r2ClassBUsage - PRICING.r2.freeClassB) * PRICING.r2.classB;

  // D1コスト計算
  const d1StorageMB = usage.fileCount * 0.001; // 推定: 1ファイル = 1KB メタデータ
  const d1StorageGB = d1StorageMB / 1024;
  const d1StorageCost = Math.max(0, d1StorageGB - PRICING.d1.freeStorageGB) * PRICING.d1.storageGB;
  const d1RowsReadCost = Math.max(0, usage.estimatedRowsRead - PRICING.d1.freeRowsRead) * PRICING.d1.rowsRead;
  const d1RowsWrittenCost = Math.max(0, usage.estimatedRowsWritten - PRICING.d1.freeRowsWritten) * PRICING.d1.rowsWritten;

  // Workersコスト計算
  const totalRequests = usage.apiRequestsThisMonth;
  const dailyRequests = totalRequests / 30;
  const billableRequests = Math.max(0, dailyRequests - PRICING.workers.freeRequests) * 30;
  const workersCost = billableRequests * PRICING.workers.requests;

  const r2Total = r2StorageCost + r2ClassACost + r2ClassBCost;
  const d1Total = d1StorageCost + d1RowsReadCost + d1RowsWrittenCost;
  const workersTotal = workersCost;

  return {
    r2: {
      storage: { usage: storageGB, cost: r2StorageCost, free: PRICING.r2.freeStorageGB },
      classA: { usage: r2ClassAUsage, cost: r2ClassACost, free: PRICING.r2.freeClassA },
      classB: { usage: r2ClassBUsage, cost: r2ClassBCost, free: PRICING.r2.freeClassB },
      total: r2Total,
    },
    d1: {
      storage: { usage: d1StorageGB, cost: d1StorageCost, free: PRICING.d1.freeStorageGB },
      rowsRead: { usage: usage.estimatedRowsRead, cost: d1RowsReadCost, free: PRICING.d1.freeRowsRead },
      rowsWritten: { usage: usage.estimatedRowsWritten, cost: d1RowsWrittenCost, free: PRICING.d1.freeRowsWritten },
      total: d1Total,
    },
    workers: {
      requests: { usage: totalRequests, cost: workersCost, free: PRICING.workers.freeRequests * 30 },
      total: workersTotal,
    },
    totalMonthly: r2Total + d1Total + workersTotal,
    currency: 'USD',
  };
}

/**
 * コストを通貨フォーマット
 */
export function formatCost(cost: number, currency: 'USD' | 'JPY' = 'USD'): string {
  if (currency === 'JPY') {
    // 1 USD = 150 JPY で概算
    const jpy = cost * 150;
    return `¥${jpy.toFixed(0)}`;
  }
  return `$${cost.toFixed(4)}`;
}

/**
 * 数値を読みやすくフォーマット
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toFixed(0);
}
