/**
 * フォームコンポーネント
 * 入力フィールド、セレクト、ラベルなど
 */

import { escapeHtml } from '../layout';

export interface InputProps {
  /** 名前（name属性） */
  name: string;
  /** ラベル */
  label: string;
  /** 入力タイプ */
  type?: 'text' | 'email' | 'password' | 'number' | 'file' | 'hidden';
  /** プレースホルダー */
  placeholder?: string;
  /** 初期値 */
  value?: string;
  /** 必須 */
  required?: boolean;
  /** 無効化 */
  disabled?: boolean;
  /** ヘルプテキスト */
  helpText?: string;
  /** エラーメッセージ */
  error?: string;
  /** 追加の属性 */
  attrs?: Record<string, string>;
  /** 追加のCSSクラス */
  className?: string;
}

/**
 * テキスト入力フィールド
 */
export function input(props: InputProps): string {
  const {
    name,
    label,
    type = 'text',
    placeholder,
    value,
    required = false,
    disabled = false,
    helpText,
    error,
    attrs = {},
    className = '',
  } = props;

  const inputClasses = `
    block w-full px-3 py-2 border rounded-lg shadow-sm
    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
    ${error ? 'border-red-300 text-red-900' : 'border-gray-300'}
    ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
    ${className}
  `.trim();

  const extraAttrs = Object.entries(attrs)
    .map(([key, val]) => `${key}="${escapeHtml(val)}"`)
    .join(' ');

  return `
  <div class="mb-4">
    <label for="${name}" class="block text-sm font-medium text-gray-700 mb-1">
      ${label}
      ${required ? '<span class="text-red-500">*</span>' : ''}
    </label>
    <input
      type="${type}"
      id="${name}"
      name="${name}"
      class="${inputClasses}"
      ${placeholder ? `placeholder="${escapeHtml(placeholder)}"` : ''}
      ${value ? `value="${escapeHtml(value)}"` : ''}
      ${required ? 'required' : ''}
      ${disabled ? 'disabled' : ''}
      ${extraAttrs}
    />
    ${helpText ? `<p class="mt-1 text-sm text-gray-500">${helpText}</p>` : ''}
    ${error ? `<p class="mt-1 text-sm text-red-600">${error}</p>` : ''}
  </div>`;
}

/**
 * テキストエリア
 */
export function textarea(
  props: Omit<InputProps, 'type'> & { rows?: number }
): string {
  const {
    name,
    label,
    placeholder,
    value,
    required = false,
    disabled = false,
    helpText,
    error,
    rows = 4,
    className = '',
  } = props;

  const textareaClasses = `
    block w-full px-3 py-2 border rounded-lg shadow-sm
    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
    ${error ? 'border-red-300 text-red-900' : 'border-gray-300'}
    ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
    ${className}
  `.trim();

  return `
  <div class="mb-4">
    <label for="${name}" class="block text-sm font-medium text-gray-700 mb-1">
      ${label}
      ${required ? '<span class="text-red-500">*</span>' : ''}
    </label>
    <textarea
      id="${name}"
      name="${name}"
      rows="${rows}"
      class="${textareaClasses}"
      ${placeholder ? `placeholder="${escapeHtml(placeholder)}"` : ''}
      ${required ? 'required' : ''}
      ${disabled ? 'disabled' : ''}
    >${value ? escapeHtml(value) : ''}</textarea>
    ${helpText ? `<p class="mt-1 text-sm text-gray-500">${helpText}</p>` : ''}
    ${error ? `<p class="mt-1 text-sm text-red-600">${error}</p>` : ''}
  </div>`;
}

/**
 * セレクトボックス
 */
export function select(
  props: Omit<InputProps, 'type' | 'placeholder'> & {
    options: Array<{ value: string; label: string }>;
  }
): string {
  const {
    name,
    label,
    value,
    required = false,
    disabled = false,
    helpText,
    error,
    options,
    className = '',
  } = props;

  const selectClasses = `
    block w-full px-3 py-2 border rounded-lg shadow-sm
    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
    ${error ? 'border-red-300 text-red-900' : 'border-gray-300'}
    ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
    ${className}
  `.trim();

  const optionsHtml = options
    .map(
      (opt) =>
        `<option value="${escapeHtml(opt.value)}" ${opt.value === value ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`
    )
    .join('\n');

  return `
  <div class="mb-4">
    <label for="${name}" class="block text-sm font-medium text-gray-700 mb-1">
      ${label}
      ${required ? '<span class="text-red-500">*</span>' : ''}
    </label>
    <select
      id="${name}"
      name="${name}"
      class="${selectClasses}"
      ${required ? 'required' : ''}
      ${disabled ? 'disabled' : ''}
    >
      ${optionsHtml}
    </select>
    ${helpText ? `<p class="mt-1 text-sm text-gray-500">${helpText}</p>` : ''}
    ${error ? `<p class="mt-1 text-sm text-red-600">${error}</p>` : ''}
  </div>`;
}

/**
 * チェックボックス
 */
export function checkbox(props: {
  name: string;
  label: string;
  checked?: boolean;
  disabled?: boolean;
  helpText?: string;
}): string {
  const { name, label, checked = false, disabled = false, helpText } = props;

  return `
  <div class="mb-4">
    <label class="inline-flex items-center">
      <input
        type="checkbox"
        name="${name}"
        class="rounded border-gray-300 text-primary-600 shadow-sm focus:ring-primary-500"
        ${checked ? 'checked' : ''}
        ${disabled ? 'disabled' : ''}
      />
      <span class="ml-2 text-sm text-gray-700">${label}</span>
    </label>
    ${helpText ? `<p class="mt-1 text-sm text-gray-500">${helpText}</p>` : ''}
  </div>`;
}

/**
 * ファイルアップロードエリア（ドラッグ&ドロップ対応）
 */
export function fileDropzone(props: {
  name: string;
  accept?: string;
  maxSize?: string;
  helpText?: string;
}): string {
  const {
    name,
    accept = '*/*',
    maxSize = '100MB',
    helpText = `最大 ${maxSize} まで`,
  } = props;

  return `
  <div class="mb-4">
    <div
      id="dropzone"
      class="dropzone relative border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-400 transition-colors"
    >
      <input
        type="file"
        id="${name}"
        name="${name}"
        accept="${accept}"
        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onchange="handleFileSelect(this)"
      />
      <div class="space-y-2">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
        </svg>
        <div class="text-sm text-gray-600">
          <span class="text-primary-600 font-medium">クリックしてファイルを選択</span>
          <span>またはドラッグ&ドロップ</span>
        </div>
        <p class="text-xs text-gray-500">${helpText}</p>
      </div>
    </div>
    <div id="file-preview" class="mt-4 hidden">
      <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div class="flex items-center space-x-3">
          <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <div>
            <p id="file-name" class="text-sm font-medium text-gray-900"></p>
            <p id="file-size" class="text-xs text-gray-500"></p>
          </div>
        </div>
        <button type="button" onclick="clearFile()" class="text-gray-400 hover:text-red-500">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>
  </div>`;
}
