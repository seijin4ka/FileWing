/**
 * 共通レイアウトテンプレート
 * Tailwind CSSを使用したHTMLレイアウト
 */

import type { Language } from '../types';
import { LANGUAGE_NAMES, createTranslator } from '../i18n';

export interface LayoutOptions {
  /** ページタイトル */
  title: string;
  /** ユーザー情報（未認証の場合はnull） */
  user?: { email: string; name?: string } | null;
  /** 追加のCSSクラス */
  bodyClass?: string;
  /** ヘッダーを非表示にするか */
  hideHeader?: boolean;
  /** 言語設定 */
  lang?: Language;
  /** 認証方式（ログアウトボタン表示制御用） */
  authMethod?: 'saml' | 'cloudflare-access' | 'local' | 'skip';
  /** 現在のURL（言語切り替え時にクエリパラメータを保持するため） */
  currentUrl?: string;
}

/**
 * 共通HTMLレイアウト
 */
export function layout(options: LayoutOptions, content: string): string {
  const { title, user, bodyClass = '', hideHeader = false, lang = 'ja', authMethod, currentUrl } = options;
  const { get } = createTranslator(lang);

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - ${get('common.appName')}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            // Cloudflare Orange（メインカラー）
            primary: {
              50: '#fff7ed',
              100: '#ffedd5',
              200: '#fed7aa',
              300: '#fdba74',
              400: '#fb923c',
              500: '#f6821f',  // Cloudflare Orange
              600: '#ea580c',
              700: '#c2410c',
              800: '#9a3412',
              900: '#7c2d12',
            },
            // Cloudflare Dark（ダークカラー）
            accent: {
              50: '#f8fafc',
              100: '#f1f5f9',
              200: '#e2e8f0',
              300: '#cbd5e1',
              400: '#94a3b8',
              500: '#64748b',
              600: '#475569',
              700: '#334155',
              800: '#1e293b',
              900: '#0f172a',  // Cloudflare Dark
            },
            // Cloudflare Blue（サブカラー）
            sky: {
              50: '#f0f9ff',
              100: '#e0f2fe',
              200: '#bae6fd',
              300: '#7dd3fc',
              400: '#38bdf8',
              500: '#0ea5e9',
              600: '#0284c7',
              700: '#0369a1',
              800: '#075985',
              900: '#0c4a6e',
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
  ${hideHeader ? '' : renderHeader(user, lang, authMethod, currentUrl)}

  <main class="container mx-auto px-4 py-8">
    ${content}
  </main>

  <!-- トースト通知コンテナ -->
  <div id="toast-container" class="fixed top-4 right-4 z-50 space-y-2"></div>

  <script>
    // HTMLエスケープ
    function escHtml(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}

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

    // 日時をフォーマット（レガシー、クライアントサイド用）
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

    // ローカル時刻表示（言語に応じたタイムゾーン）
    // 日本語: JST (GMT+9), 英語: UTC (GMT)
    (function() {
      function formatLocalTime(isoString, locale) {
        const date = new Date(isoString);
        const timeZone = locale === 'ja' ? 'Asia/Tokyo' : 'UTC';
        const options = {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: timeZone
        };
        const formatted = new Intl.DateTimeFormat(locale, options).format(date);
        return locale === 'ja' ? formatted : formatted + ' UTC';
      }

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

      document.addEventListener('DOMContentLoaded', function() {
        const locale = document.documentElement.lang || 'ja';

        // .local-time クラスの要素を変換（秒まで表示、相対時間をツールチップ）
        document.querySelectorAll('.local-time').forEach(function(el) {
          const isoString = el.getAttribute('datetime');
          if (isoString) {
            el.textContent = formatLocalTime(isoString, locale);
            el.title = formatRelativeTime(isoString, locale);
          }
        });

        // .local-datetime クラスの要素を変換（秒なし、シンプル表示）
        document.querySelectorAll('.local-datetime').forEach(function(el) {
          const isoString = el.getAttribute('datetime');
          if (isoString) {
            const date = new Date(isoString);
            const timeZone = locale === 'ja' ? 'Asia/Tokyo' : 'UTC';
            const options = {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
              timeZone: timeZone
            };
            const formatted = new Intl.DateTimeFormat(locale, options).format(date);
            el.textContent = locale === 'ja' ? formatted : formatted + ' UTC';
          }
        });
      });
    })();

    // モバイルメニューを切り替える
    function toggleMobileMenu() {
      const menu = document.getElementById('mobile-menu');
      if (menu) {
        menu.classList.toggle('hidden');
      }
    }
  </script>
</body>
</html>`;
}

/**
 * ヘッダーをレンダリング
 */
function renderHeader(
  user?: { email: string; name?: string } | null,
  lang: Language = 'ja',
  authMethod?: 'saml' | 'cloudflare-access' | 'local' | 'skip',
  currentUrl?: string
): string {
  const { get } = createTranslator(lang);
  const otherLang = lang === 'ja' ? 'en' : 'ja';
  const otherLangName = LANGUAGE_NAMES[otherLang];

  // 言語切り替えURLを生成（既存クエリパラメータを保持）
  function buildLangUrl(targetLang: string): string {
    if (!currentUrl) return `?lang=${targetLang}`;
    try {
      const url = new URL(currentUrl.startsWith('http') ? currentUrl : `http://localhost${currentUrl}`);
      url.searchParams.set('lang', targetLang);
      const pathname = url.pathname;
      const search = url.search;
      return pathname + search;
    } catch {
      return `?lang=${targetLang}`;
    }
  }

  // アプリ側でセッションを管理する認証方式の場合のみログアウトボタンを表示
  // Cloudflare Access認証の場合はCloudflare側でセッション管理されるため非表示
  // 認証スキップの場合はログアウトする対象がないため非表示
  const showLogout = authMethod === 'saml' || authMethod === 'local';

  return `
  <header class="bg-primary-500 shadow-lg">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center space-x-8">
          <a href="/" class="text-xl font-bold text-white">
            ${get('common.appName')}
          </a>
          ${user ? `
          <nav class="hidden md:flex space-x-6">
            <a href="/" class="text-primary-100 hover:text-white transition-colors">${get('nav.dashboard')}</a>
            <a href="/upload" class="text-primary-100 hover:text-white transition-colors">${get('nav.upload')}</a>
            <a href="/receive" class="text-primary-100 hover:text-white transition-colors">${get('nav.receive')}</a>
            <a href="/files" class="text-primary-100 hover:text-white transition-colors">${get('nav.files')}</a>
            <a href="/links" class="text-primary-100 hover:text-white transition-colors">${get('nav.links')}</a>
            <a href="/costs" class="text-primary-100 hover:text-white transition-colors">${get('nav.costs')}</a>
          </nav>
          ` : ''}
        </div>
        <div class="flex items-center space-x-4">
          <!-- モバイルメニューボタン -->
          ${user ? `
          <button id="mobile-menu-btn" class="md:hidden text-white p-2 hover:bg-primary-600 rounded-lg transition-colors" onclick="toggleMobileMenu()">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </button>
          ` : ''}
          <!-- 言語切り替え -->
          <a href="${buildLangUrl(otherLang)}" class="text-sm text-primary-100 hover:text-white transition-colors">
            ${otherLangName}
          </a>
          ${user ? `
          <span class="text-sm text-primary-100">${escapeHtml(user.name || user.email)}</span>
          <div class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <span class="text-white font-medium">${escapeHtml((user.name || user.email)[0].toUpperCase())}</span>
          </div>
          ${showLogout ? `
          <a href="/auth/logout" class="text-sm text-primary-100 hover:text-white transition-colors ml-2">
            ${get('nav.logout')}
          </a>
          ` : ''}
          ` : ''}
        </div>
      </div>
    </div>
    <!-- モバイルナビゲーションメニュー -->
    ${user ? `
    <div id="mobile-menu" class="hidden md:hidden bg-primary-600 border-t border-primary-400">
      <nav class="container mx-auto px-4 py-3 flex flex-col space-y-2">
        <a href="/" class="block px-3 py-2 text-primary-100 hover:text-white hover:bg-primary-500 rounded-lg transition-colors">${get('nav.dashboard')}</a>
        <a href="/upload" class="block px-3 py-2 text-primary-100 hover:text-white hover:bg-primary-500 rounded-lg transition-colors">${get('nav.upload')}</a>
        <a href="/receive" class="block px-3 py-2 text-primary-100 hover:text-white hover:bg-primary-500 rounded-lg transition-colors">${get('nav.receive')}</a>
        <a href="/files" class="block px-3 py-2 text-primary-100 hover:text-white hover:bg-primary-500 rounded-lg transition-colors">${get('nav.files')}</a>
        <a href="/links" class="block px-3 py-2 text-primary-100 hover:text-white hover:bg-primary-500 rounded-lg transition-colors">${get('nav.links')}</a>
        <a href="/costs" class="block px-3 py-2 text-primary-100 hover:text-white hover:bg-primary-500 rounded-lg transition-colors">${get('nav.costs')}</a>
      </nav>
    </div>
    ` : ''}
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
 * JavaScript文字列リテラル用のエスケープ
 * テンプレートリテラル内の文字列や、クォート内の文字列を安全にエスケープ
 */
export function escapeJsString(text: string): string {
  return text
    .replace(/\\/g, '\\\\') // バックスラッシュを最初にエスケープ
    .replace(/'/g, "\\'")   // シングルクォート
    .replace(/"/g, '\\"')   // ダブルクォート
    .replace(/`/g, '\\`')   // バッククォート（テンプレートリテラル用）
    .replace(/\$/g, '\\$')  // ドル記号（テンプレートリテラルの変数展開防止）
    .replace(/\n/g, '\\n')  // 改行
    .replace(/\r/g, '\\r')  // キャリッジリターン
    .replace(/\t/g, '\\t')  // タブ
    .replace(/</g, '\\u003c') // HTMLタグ開始（script終了タグ対策）
    .replace(/>/g, '\\u003e'); // HTMLタグ終了
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
 * 日時をフォーマット（日本語）- レガシー用
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
 * DB日時文字列をISO 8601形式（UTC）に変換
 * "2026-02-04 03:03:09" -> "2026-02-04T03:03:09Z"
 */
export function toISOString(dbDateTime: string): string {
  // 既にISO形式の場合はそのまま返す
  if (dbDateTime.includes('T')) {
    return dbDateTime.endsWith('Z') ? dbDateTime : dbDateTime + 'Z';
  }
  return dbDateTime.replace(' ', 'T') + 'Z';
}

/**
 * ローカル時刻表示用の<time>要素を生成（秒まで表示、相対時間ツールチップ）
 * クライアントサイドでブラウザのタイムゾーンに変換される
 */
export function localTime(dbDateTime: string, className: string = ''): string {
  const iso = toISOString(dbDateTime);
  const classes = `local-time ${className}`.trim();
  return `<time class="${classes}" datetime="${iso}"></time>`;
}

/**
 * ローカル日時表示用の<time>要素を生成（秒なし、シンプル表示）
 * クライアントサイドでブラウザのタイムゾーンに変換される
 */
export function localDateTime(dbDateTime: string, className: string = ''): string {
  const iso = toISOString(dbDateTime);
  const classes = `local-datetime ${className}`.trim();
  return `<time class="${classes}" datetime="${iso}"></time>`;
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

/**
 * エラーページをレンダリング
 */
export function renderErrorPage(title: string, reasons: string[], footer?: string): string {
  return `
    <div class="min-h-screen flex items-center justify-center py-12 px-4">
      <div class="max-w-md w-full text-center">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-6">
          <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 mb-4">${title}</h1>
        <div class="bg-white rounded-lg shadow-sm border p-6 text-left">
          <p class="text-gray-600 mb-4">考えられる原因:</p>
          <ul class="space-y-2 text-sm text-gray-500">
            ${reasons.map((r) => `<li class="flex items-start"><span class="mr-2">•</span>${r}</li>`).join('')}
          </ul>
        </div>
        ${footer ? `<p class="mt-6 text-sm text-gray-500">${footer}</p>` : ''}
      </div>
    </div>
  `;
}
