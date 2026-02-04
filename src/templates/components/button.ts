/**
 * ボタンコンポーネント
 * 各種アクション用のボタンスタイル
 */

export interface ButtonProps {
  /** ボタンテキスト */
  text: string;
  /** ボタンタイプ */
  type?: 'button' | 'submit' | 'reset';
  /** バリアント */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';
  /** サイズ */
  size?: 'sm' | 'md' | 'lg';
  /** 無効化 */
  disabled?: boolean;
  /** アイコン（左側） */
  icon?: string;
  /** 追加のCSSクラス */
  className?: string;
  /** onclick属性 */
  onclick?: string;
  /** id属性 */
  id?: string;
}

/**
 * ボタンをレンダリング
 */
export function button(props: ButtonProps): string {
  const {
    text,
    type = 'button',
    variant = 'primary',
    size = 'md',
    disabled = false,
    icon,
    className = '',
    onclick,
    id,
  } = props;

  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variantClasses = {
    primary:
      'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-500 disabled:bg-primary-300',
    secondary:
      'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-primary-500 disabled:bg-gray-100',
    danger:
      'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300',
    ghost:
      'text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-500',
    accent:
      'bg-accent-500 text-white hover:bg-accent-600 focus:ring-accent-500 disabled:bg-accent-300',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  const attrs = [
    `type="${type}"`,
    `class="${classes}"`,
    disabled ? 'disabled' : '',
    onclick ? `onclick="${onclick}"` : '',
    id ? `id="${id}"` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return `
  <button ${attrs}>
    ${icon ? `<span class="mr-2">${icon}</span>` : ''}
    ${text}
  </button>`;
}

/**
 * リンクボタン（a要素）
 */
export function linkButton(props: ButtonProps & { href: string }): string {
  const {
    text,
    variant = 'primary',
    size = 'md',
    icon,
    className = '',
    href,
  } = props;

  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variantClasses = {
    primary:
      'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-500',
    secondary:
      'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-primary-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-500',
    accent: 'bg-accent-500 text-white hover:bg-accent-600 focus:ring-accent-500',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return `
  <a href="${href}" class="${classes}">
    ${icon ? `<span class="mr-2">${icon}</span>` : ''}
    ${text}
  </a>`;
}

/**
 * アイコンボタン
 */
export function iconButton(props: {
  icon: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  onclick?: string;
  className?: string;
}): string {
  const {
    icon,
    label,
    variant = 'ghost',
    size = 'md',
    onclick,
    className = '',
  } = props;

  const variantClasses = {
    primary: 'bg-primary-500 text-white hover:bg-primary-600',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
    accent: 'bg-accent-500 text-white hover:bg-accent-600',
  };

  const sizeClasses = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-3',
  };

  const classes = `rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return `
  <button type="button" class="${classes}" title="${label}" ${onclick ? `onclick="${onclick}"` : ''}>
    ${icon}
    <span class="sr-only">${label}</span>
  </button>`;
}
