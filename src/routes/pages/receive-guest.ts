/**
 * ゲスト受信ページ（公開）
 * 外部ユーザーがファイルをアップロードするページ
 */

import { Hono } from 'hono';
import type { Env } from '../../types';
import { layout, formatDateTime, escapeHtml } from '../../templates/layout';
import {
  getValidReceiveLinkByToken,
  getReceivedFileCount,
  createReceivedFile,
} from '../../services/d1';
import { uploadFile, guessMimeType } from '../../services/r2';

const receiveGuest = new Hono<{ Bindings: Env }>();

/**
 * GET /r/:token
 * ゲスト用アップロードページ
 */
receiveGuest.get('/:token', async (c) => {
  const token = c.req.param('token');

  // リンク情報を取得
  const link = await getValidReceiveLinkByToken(c.env.DB, token);

  if (!link) {
    return c.html(
      layout(
        { title: 'リンクが無効です', hideHeader: true },
        renderErrorPage('このリンクは無効か期限切れです', [
          'リンクの有効期限が切れている可能性があります',
          'リンクが無効化されている可能性があります',
        ])
      )
    );
  }

  // ファイル数チェック
  const currentFileCount = await getReceivedFileCount(c.env.DB, link.id);
  const maxFilesReached = link.max_files !== null && currentFileCount >= link.max_files;

  const content = `
    <div class="min-h-screen flex items-center justify-center py-12 px-4">
      <div class="max-w-lg w-full">
        <!-- ロゴ/タイトル -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            <svg class="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-gray-900">ファイルを送信</h1>
          ${link.title ? `<p class="mt-2 text-gray-600">${escapeHtml(link.title)}</p>` : ''}
        </div>

        ${maxFilesReached ? `
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <svg class="w-12 h-12 text-yellow-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
          <h2 class="text-lg font-medium text-yellow-800">受信上限に達しました</h2>
          <p class="mt-2 text-sm text-yellow-600">このリンクでのファイル受信数が上限に達しています。</p>
        </div>
        ` : `
        <!-- アップロードフォーム -->
        <div class="bg-white rounded-lg shadow-lg border overflow-hidden">
          <div class="p-6">
            <form id="upload-form" class="space-y-6">
              <!-- ファイル選択 -->
              <div
                id="dropzone"
                class="dropzone relative border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-400 transition-colors"
              >
                <input
                  type="file"
                  id="file"
                  name="file"
                  class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onchange="handleFileSelect(this)"
                />
                <div class="space-y-2">
                  <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                  </svg>
                  <div class="text-sm text-gray-600">
                    <span class="text-primary-500 font-medium">クリックしてファイルを選択</span>
                    <span>またはドラッグ&ドロップ</span>
                  </div>
                  <p class="text-xs text-gray-500">最大 ${link.max_file_size ? formatFileSize(link.max_file_size) : '100MB'}</p>
                </div>
              </div>
              <div id="file-preview" class="hidden">
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

              <!-- 送信者情報（オプション） -->
              <div class="space-y-4">
                <div>
                  <label for="sender_name" class="block text-sm font-medium text-gray-700 mb-1">お名前（任意）</label>
                  <input type="text" id="sender_name" name="sender_name" placeholder="山田 太郎" class="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                </div>
                <div>
                  <label for="sender_email" class="block text-sm font-medium text-gray-700 mb-1">メールアドレス（任意）</label>
                  <input type="email" id="sender_email" name="sender_email" placeholder="example@company.com" class="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                </div>
                <div>
                  <label for="message" class="block text-sm font-medium text-gray-700 mb-1">メッセージ（任意）</label>
                  <textarea id="message" name="message" rows="3" placeholder="ファイルについてのコメント" class="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"></textarea>
                </div>
              </div>

              <!-- 送信ボタン -->
              <button
                type="submit"
                id="submit-btn"
                class="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors disabled:bg-primary-300"
              >
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                </svg>
                ファイルを送信
              </button>
            </form>

            <!-- 進捗表示 -->
            <div id="upload-progress" class="hidden mt-6">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-gray-700">アップロード中...</span>
                <span id="progress-percent" class="text-sm text-gray-500">0%</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div id="progress-bar" class="bg-primary-500 h-2 rounded-full transition-all" style="width: 0%"></div>
              </div>
            </div>

            <!-- 完了表示 -->
            <div id="upload-success" class="hidden mt-6">
              <div class="text-center py-6">
                <svg class="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <h3 class="text-lg font-medium text-gray-900">送信完了</h3>
                <p class="mt-2 text-sm text-gray-500">ファイルが正常に送信されました。</p>
                <button type="button" onclick="resetForm()" class="mt-4 text-primary-500 hover:text-primary-600 font-medium">
                  別のファイルを送信
                </button>
              </div>
            </div>

            <!-- エラー表示 -->
            <div id="error-message" class="hidden mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"></div>
          </div>

          <!-- メタ情報 -->
          <div class="bg-gray-50 px-6 py-4 text-xs text-gray-500">
            <div class="flex items-center justify-between">
              <span>有効期限: ${formatDateTime(link.expires_at)}</span>
              ${link.max_files ? `<span>残り: ${link.max_files - currentFileCount}件</span>` : ''}
            </div>
          </div>
        </div>
        `}
      </div>
    </div>

    <script>
      let selectedFile = null;
      const maxFileSize = ${link.max_file_size || 100 * 1024 * 1024};

      // ドラッグ&ドロップの設定
      const dropzone = document.getElementById('dropzone');
      if (dropzone) {
        ['dragenter', 'dragover'].forEach(event => {
          dropzone.addEventListener(event, (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
          });
        });

        ['dragleave', 'drop'].forEach(event => {
          dropzone.addEventListener(event, (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
          });
        });

        dropzone.addEventListener('drop', (e) => {
          const files = e.dataTransfer.files;
          if (files.length > 0) {
            handleFile(files[0]);
          }
        });
      }

      function handleFileSelect(input) {
        if (input.files.length > 0) {
          handleFile(input.files[0]);
        }
      }

      function handleFile(file) {
        if (file.size > maxFileSize) {
          showError('ファイルサイズが大きすぎます');
          return;
        }
        selectedFile = file;
        document.getElementById('file-name').textContent = file.name;
        document.getElementById('file-size').textContent = formatFileSize(file.size);
        document.getElementById('file-preview').classList.remove('hidden');
        document.getElementById('dropzone').classList.add('hidden');
      }

      function clearFile() {
        selectedFile = null;
        document.getElementById('file').value = '';
        document.getElementById('file-preview').classList.add('hidden');
        document.getElementById('dropzone').classList.remove('hidden');
      }

      function formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let i = 0;
        while (bytes >= 1024 && i < units.length - 1) {
          bytes /= 1024;
          i++;
        }
        return bytes.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
      }

      function showError(message) {
        const errorDiv = document.getElementById('error-message');
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
      }

      // フォーム送信
      const form = document.getElementById('upload-form');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();

          if (!selectedFile) {
            showError('ファイルを選択してください');
            return;
          }

          const submitBtn = document.getElementById('submit-btn');
          const progressDiv = document.getElementById('upload-progress');
          const progressBar = document.getElementById('progress-bar');
          const progressPercent = document.getElementById('progress-percent');
          const errorDiv = document.getElementById('error-message');

          submitBtn.disabled = true;
          errorDiv.classList.add('hidden');
          progressDiv.classList.remove('hidden');

          try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('sender_name', document.getElementById('sender_name').value);
            formData.append('sender_email', document.getElementById('sender_email').value);
            formData.append('message', document.getElementById('message').value);

            const result = await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('POST', '/r/${token}/upload');

              xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                  const percent = Math.round((e.loaded / e.total) * 100);
                  progressBar.style.width = percent + '%';
                  progressPercent.textContent = percent + '%';
                }
              };

              xhr.onload = () => {
                if (xhr.status === 200) {
                  resolve(JSON.parse(xhr.responseText));
                } else {
                  try {
                    const err = JSON.parse(xhr.responseText);
                    reject(new Error(err.error || 'アップロードに失敗しました'));
                  } catch {
                    reject(new Error('アップロードに失敗しました'));
                  }
                }
              };

              xhr.onerror = () => reject(new Error('ネットワークエラー'));
              xhr.send(formData);
            });

            if (!result.success) {
              throw new Error(result.error);
            }

            // 成功表示
            progressDiv.classList.add('hidden');
            document.getElementById('upload-form').classList.add('hidden');
            document.getElementById('upload-success').classList.remove('hidden');

          } catch (error) {
            showError(error.message);
            progressDiv.classList.add('hidden');
            submitBtn.disabled = false;
          }
        });
      }

      function resetForm() {
        clearFile();
        document.getElementById('sender_name').value = '';
        document.getElementById('sender_email').value = '';
        document.getElementById('message').value = '';
        document.getElementById('upload-form').classList.remove('hidden');
        document.getElementById('upload-success').classList.add('hidden');
        document.getElementById('error-message').classList.add('hidden');
        document.getElementById('submit-btn').disabled = false;
      }
    </script>
  `;

  return c.html(layout({ title: 'ファイル送信', hideHeader: true, bodyClass: 'bg-gray-100' }, content));
});

/**
 * POST /r/:token/upload
 * ゲストからのファイルアップロード
 */
receiveGuest.post('/:token/upload', async (c) => {
  const token = c.req.param('token');

  // リンク情報を取得
  const link = await getValidReceiveLinkByToken(c.env.DB, token);

  if (!link) {
    return c.json({ success: false, error: 'リンクが無効か期限切れです' }, 404);
  }

  // ファイル数チェック
  if (link.max_files !== null) {
    const currentCount = await getReceivedFileCount(c.env.DB, link.id);
    if (currentCount >= link.max_files) {
      return c.json({ success: false, error: '受信上限に達しています' }, 400);
    }
  }

  try {
    const formData = await c.req.formData();
    const formFile = formData.get('file');
    const senderName = formData.get('sender_name') as string | null;
    const senderEmail = formData.get('sender_email') as string | null;
    const message = formData.get('message') as string | null;

    if (!formFile || typeof formFile === 'string') {
      return c.json({ success: false, error: 'ファイルが指定されていません' }, 400);
    }

    const file = formFile as File;

    // ファイルサイズチェック
    const maxSize = link.max_file_size || 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ success: false, error: 'ファイルサイズが大きすぎます' }, 400);
    }

    const mimeType = file.type || guessMimeType(file.name);

    // R2キーを生成（受信ファイル用のプレフィックス）
    const r2Key = `received/${link.id}/${Date.now()}-${crypto.randomUUID()}/${file.name}`;

    // R2にアップロード
    const arrayBuffer = await file.arrayBuffer();
    await uploadFile(c.env.R2_BUCKET, r2Key, arrayBuffer, mimeType);

    // IPアドレス取得
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');

    // DBに記録
    const receivedFile = await createReceivedFile(
      c.env.DB,
      link.id,
      r2Key,
      file.name,
      file.size,
      mimeType,
      senderName || undefined,
      senderEmail || undefined,
      message || undefined,
      ipAddress
    );

    return c.json({ success: true, file: receivedFile });
  } catch (error) {
    console.error('受信アップロードエラー:', error);
    return c.json({ success: false, error: 'アップロードに失敗しました' }, 500);
  }
});

/**
 * エラーページをレンダリング
 */
function renderErrorPage(title: string, reasons: string[]): string {
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
      </div>
    </div>
  `;
}

/**
 * ファイルサイズをフォーマット
 */
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

export default receiveGuest;
