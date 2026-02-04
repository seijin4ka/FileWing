/**
 * テーブルコンポーネント
 * ファイル一覧やダウンロード履歴の表示に使用
 */

export interface Column<T> {
  /** カラムキー */
  key: string;
  /** ヘッダーラベル */
  label: string;
  /** 幅（Tailwindクラス） */
  width?: string;
  /** セルのレンダリング関数 */
  render?: (row: T, index: number) => string;
  /** 配置 */
  align?: 'left' | 'center' | 'right';
}

export interface TableProps<T> {
  /** カラム定義 */
  columns: Column<T>[];
  /** データ配列 */
  data: T[];
  /** データがない場合のメッセージ */
  emptyMessage?: string;
  /** 行のクリック時のハンドラ（JavaScript） */
  onRowClick?: string;
  /** 追加のCSSクラス */
  className?: string;
}

/**
 * テーブルをレンダリング
 */
export function table<T extends Record<string, unknown>>(
  props: TableProps<T>
): string {
  const {
    columns,
    data,
    emptyMessage = 'データがありません',
    onRowClick,
    className = '',
  } = props;

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  const headerCells = columns
    .map(
      (col) => `
      <th scope="col" class="px-6 py-3 ${alignClasses[col.align || 'left']} text-xs font-medium text-gray-500 uppercase tracking-wider ${col.width || ''}">
        ${col.label}
      </th>`
    )
    .join('');

  const rows =
    data.length === 0
      ? `
      <tr>
        <td colspan="${columns.length}" class="px-6 py-12 text-center text-gray-500">
          ${emptyMessage}
        </td>
      </tr>`
      : data
          .map((row, index) => {
            const cells = columns
              .map((col) => {
                const content = col.render
                  ? col.render(row, index)
                  : String(row[col.key] ?? '');
                return `
                <td class="px-6 py-4 whitespace-nowrap ${alignClasses[col.align || 'left']}">
                  ${content}
                </td>`;
              })
              .join('');

            const rowAttrs = onRowClick
              ? `class="hover:bg-gray-50 cursor-pointer" onclick="${onRowClick}(${index})"`
              : 'class="hover:bg-gray-50"';

            return `<tr ${rowAttrs}>${cells}</tr>`;
          })
          .join('');

  return `
  <div class="overflow-x-auto ${className}">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          ${headerCells}
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        ${rows}
      </tbody>
    </table>
  </div>`;
}

/**
 * バッジ（ステータス表示用）
 */
export function badge(props: {
  text: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
}): string {
  const { text, variant = 'default' } = props;

  const variantClasses = {
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
    default: 'bg-gray-100 text-gray-800',
  };

  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]}">${text}</span>`;
}

/**
 * ページネーション
 */
export function pagination(props: {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
}): string {
  const { currentPage, totalPages, baseUrl } = props;

  if (totalPages <= 1) return '';

  const pages: string[] = [];

  // 前へ
  if (currentPage > 1) {
    pages.push(`
      <a href="${baseUrl}?page=${currentPage - 1}" class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
        <span class="sr-only">前へ</span>
        <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
      </a>
    `);
  }

  // ページ番号
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      const isActive = i === currentPage;
      pages.push(`
        <a href="${baseUrl}?page=${i}" class="relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
          isActive
            ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
        }">
          ${i}
        </a>
      `);
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      pages.push(`
        <span class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
          ...
        </span>
      `);
    }
  }

  // 次へ
  if (currentPage < totalPages) {
    pages.push(`
      <a href="${baseUrl}?page=${currentPage + 1}" class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
        <span class="sr-only">次へ</span>
        <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
        </svg>
      </a>
    `);
  }

  return `
  <nav class="flex items-center justify-center mt-6">
    <div class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
      ${pages.join('')}
    </div>
  </nav>`;
}
