/**
 * 共通レイアウトテンプレート
 * Tailwind CSSを使用したHTMLレイアウト
 */

export interface LayoutOptions {
  /** ページタイトル */
  title: string;
  /** ユーザー情報（未認証の場合はnull） */
  user?: { email: string; name?: string } | null;
  /** 追加のCSSクラス */
  bodyClass?: string;
  /** ヘッダーを非表示にするか */
  hideHeader?: boolean;
}

/**
 * 共通HTMLレイアウト
 */
export function layout(options: LayoutOptions, content: string): string {
  const { title, user, bodyClass = '', hideHeader = false } = options;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - ファイル共有システム</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            // 主調色: 濃紺
            primary: {
              50: '#f0f7fa',
              100: '#d9eaf2',
              200: '#b3d5e5',
              300: '#8cbfd8',
              400: '#5299bc',
              500: '#27668a',
              600: '#1f5270',
              700: '#183f56',
              800: '#102b3c',
              900: '#081822',
            },
            // アクセント: ピンク
            accent: {
              50: '#fff0f3',
              100: '#ffe0e8',
              200: '#ffc1d1',
              300: '#ff92ae',
              400: '#ff6088',
              500: '#ff3066',
              600: '#ed1152',
              700: '#c80843',
              800: '#a6093d',
              900: '#8a0c39',
            },
            // サブアクセント: 水色
            sky: {
              50: '#f0faff',
              100: '#e0f4fe',
              200: '#b9eafd',
              300: '#7cdbfc',
              400: '#52b7fd',
              500: '#1a9beb',
              600: '#0d7cc9',
              700: '#0d63a3',
              800: '#105386',
              900: '#13456f',
            }
          }
        }
      }
    }
  </script>
  <style>
    /* ドラッグ&ドロップエリアのスタイル */
    .dropzone {
      transition: all 0.3s ease;
    }
    .dropzone.dragover {
      border-color: #27668a;
      background-color: #f0f7fa;
    }
    /* ローディングスピナー */
    .spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #27668a;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    /* トースト通知 */
    .toast {
      animation: slideIn 0.3s ease;
    }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  </style>
</head>
<body class="bg-gray-50 min-h-screen ${bodyClass}">
  ${hideHeader ? '' : renderHeader(user)}

  <main class="container mx-auto px-4 py-8">
    ${content}
  </main>

  <!-- トースト通知コンテナ -->
  <div id="toast-container" class="fixed top-4 right-4 z-50 space-y-2"></div>

  <script>
    // トースト通知を表示
    function showToast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
        warning: 'bg-yellow-500'
      };
      toast.className = 'toast ' + colors[type] + ' text-white px-6 py-3 rounded-lg shadow-lg';
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 5000);
    }

    // 確認ダイアログ
    function confirmAction(message) {
      return confirm(message);
    }

    // ファイルサイズをフォーマット
    function formatFileSize(bytes) {
      const units = ['B', 'KB', 'MB', 'GB'];
      let i = 0;
      while (bytes >= 1024 && i < units.length - 1) {
        bytes /= 1024;
        i++;
      }
      return bytes.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
    }

    // 日時をフォーマット
    function formatDate(isoString) {
      const date = new Date(isoString);
      return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  </script>
</body>
</html>`;
}

/**
 * ヘッダーをレンダリング
 */
function renderHeader(user?: { email: string; name?: string } | null): string {
  return `
  <header class="bg-primary-500 shadow-lg">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center space-x-8">
          <a href="/" class="text-xl font-bold text-white">
            ファイル共有
          </a>
          ${user ? `
          <nav class="hidden md:flex space-x-6">
            <a href="/" class="text-primary-100 hover:text-white transition-colors">ダッシュボード</a>
            <a href="/upload" class="text-primary-100 hover:text-white transition-colors">送信</a>
            <a href="/receive" class="text-primary-100 hover:text-white transition-colors">受信</a>
            <a href="/files" class="text-primary-100 hover:text-white transition-colors">管理</a>
          </nav>
          ` : ''}
        </div>
        ${user ? `
        <div class="flex items-center space-x-4">
          <span class="text-sm text-primary-100">${escapeHtml(user.name || user.email)}</span>
          <div class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <span class="text-white font-medium">${escapeHtml((user.name || user.email)[0].toUpperCase())}</span>
          </div>
        </div>
        ` : ''}
      </div>
    </div>
  </header>`;
}

/**
 * HTMLエスケープ
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * ファイルサイズをフォーマット
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

/**
 * 日時をフォーマット（日本語）
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });
}

/**
 * 相対時間をフォーマット
 */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'たった今';
  if (diffMins < 60) return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 7) return `${diffDays}日前`;
  return formatDateTime(isoString);
}
