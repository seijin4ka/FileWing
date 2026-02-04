/**
 * アップロードページ
 * ドラッグ&ドロップ対応のファイルアップロード画面
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';
import { layout } from '../../templates/layout';
import { fileDropzone, select, input, textarea } from '../../templates/components/form';
import { button } from '../../templates/components/button';

const upload = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /upload
 * アップロード画面
 */
upload.get('/', async (c) => {
  const user = c.get('user');

  const content = `
    <div class="max-w-2xl mx-auto">
      <!-- ページヘッダー -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-900">ファイルをアップロード</h1>
        <p class="text-gray-600">ファイルをアップロードして共有リンクを作成できます</p>
      </div>

      <!-- アップロードフォーム -->
      <form id="upload-form" class="space-y-6">
        <!-- ファイル選択 -->
        ${fileDropzone({ name: 'file', accept: '*/*', maxSize: '100MB' })}

        <!-- オプション設定 -->
        <div class="bg-white rounded-lg shadow-sm border p-6 space-y-4">
          <h2 class="text-lg font-medium text-gray-900 mb-4">共有設定</h2>

          ${select({
            name: 'expires_days',
            label: '有効期限',
            options: [
              { value: '1', label: '1日' },
              { value: '3', label: '3日' },
              { value: '7', label: '7日（推奨）' },
              { value: '10', label: '10日' },
            ],
            value: '7',
            helpText: 'リンクの有効期限を設定します',
          })}

          ${input({
            name: 'password',
            label: 'パスワード（オプション）',
            type: 'password',
            placeholder: 'ダウンロード時に必要なパスワード',
            helpText: '設定するとダウンロード時にパスワード入力が必要になります',
          })}

          ${input({
            name: 'max_downloads',
            label: '最大ダウンロード回数（オプション）',
            type: 'number',
            placeholder: '無制限',
            attrs: { min: '1', max: '1000' },
            helpText: '指定回数ダウンロードされるとリンクが無効になります',
          })}

          ${textarea({
            name: 'recipients',
            label: '送信先メールアドレス（オプション）',
            placeholder: 'example@company.com\nuser@example.org',
            rows: 3,
            helpText: '1行に1つのメールアドレスを入力してください',
          })}

          ${textarea({
            name: 'message',
            label: 'メッセージ（オプション）',
            placeholder: 'ダウンロードリンクと一緒に送信するメッセージ',
            rows: 3,
          })}
        </div>

        <!-- 送信ボタン -->
        <div class="flex items-center justify-between">
          <a href="/" class="text-gray-600 hover:text-gray-900">キャンセル</a>
          ${button({ text: 'アップロード', type: 'submit', variant: 'primary', size: 'lg', id: 'submit-btn' })}
        </div>
      </form>

      <!-- 進捗表示 -->
      <div id="upload-progress" class="hidden mt-6">
        <div class="bg-white rounded-lg shadow-sm border p-6">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-700">アップロード中...</span>
            <span id="progress-percent" class="text-sm text-gray-500">0%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div id="progress-bar" class="bg-primary-600 h-2 rounded-full transition-all" style="width: 0%"></div>
          </div>
        </div>
      </div>

      <!-- 結果表示 -->
      <div id="upload-result" class="hidden mt-6">
        <div class="bg-green-50 border border-green-200 rounded-lg p-6">
          <div class="flex items-start">
            <svg class="w-6 h-6 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div class="ml-3 flex-1">
              <h3 class="text-lg font-medium text-green-800">アップロード完了</h3>
              <div class="mt-4 space-y-3">
                <div>
                  <label class="block text-sm font-medium text-green-700">ダウンロードリンク</label>
                  <div class="mt-1 flex rounded-md shadow-sm">
                    <input type="text" id="download-url" readonly class="flex-1 min-w-0 block px-3 py-2 rounded-l-md border border-green-300 bg-white text-sm" />
                    <button type="button" onclick="copyUrl()" class="inline-flex items-center px-4 py-2 border border-l-0 border-green-300 rounded-r-md bg-green-50 text-sm font-medium text-green-700 hover:bg-green-100">
                      コピー
                    </button>
                  </div>
                </div>
                <div id="email-status" class="hidden">
                  <p class="text-sm text-green-700">
                    <svg class="inline w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                    </svg>
                    メールを送信しました
                  </p>
                </div>
              </div>
              <div class="mt-4 flex space-x-4">
                <a href="/files" class="text-sm font-medium text-green-700 hover:text-green-600">ファイル一覧へ →</a>
                <button type="button" onclick="resetForm()" class="text-sm font-medium text-green-700 hover:text-green-600">別のファイルをアップロード</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <script>
      let selectedFile = null;

      // ドラッグ&ドロップの設定
      const dropzone = document.getElementById('dropzone');

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

      // ファイル選択
      function handleFileSelect(input) {
        if (input.files.length > 0) {
          handleFile(input.files[0]);
        }
      }

      function handleFile(file) {
        // ファイルサイズチェック（100MB）
        if (file.size > 100 * 1024 * 1024) {
          showToast('ファイルサイズは100MB以下にしてください', 'error');
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

      // フォーム送信
      document.getElementById('upload-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!selectedFile) {
          showToast('ファイルを選択してください', 'error');
          return;
        }

        const submitBtn = document.getElementById('submit-btn');
        submitBtn.disabled = true;

        const progressDiv = document.getElementById('upload-progress');
        const progressBar = document.getElementById('progress-bar');
        const progressPercent = document.getElementById('progress-percent');
        progressDiv.classList.remove('hidden');

        try {
          // ファイルをアップロード
          const formData = new FormData();
          formData.append('file', selectedFile);

          // XHRでプログレス表示
          const uploadResult = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/files');

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
                reject(new Error(xhr.responseText));
              }
            };

            xhr.onerror = () => reject(new Error('アップロードに失敗しました'));
            xhr.send(formData);
          });

          if (!uploadResult.success) {
            throw new Error(uploadResult.error);
          }

          // ダウンロードリンクを作成
          const linkData = {
            expires_days: parseInt(document.getElementById('expires_days').value),
            password: document.getElementById('password').value || undefined,
            max_downloads: document.getElementById('max_downloads').value
              ? parseInt(document.getElementById('max_downloads').value)
              : undefined,
          };

          const linkRes = await fetch('/api/files/' + uploadResult.file.id + '/links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(linkData),
          });

          const linkResult = await linkRes.json();
          if (!linkResult.success) {
            throw new Error(linkResult.error);
          }

          // 結果を表示
          document.getElementById('download-url').value = linkResult.link.url;
          progressDiv.classList.add('hidden');
          document.getElementById('upload-result').classList.remove('hidden');

          // メール送信（送信先が指定されている場合）
          const recipientsText = document.getElementById('recipients').value.trim();
          if (recipientsText) {
            const recipients = recipientsText.split('\\n').map(e => e.trim()).filter(e => e);
            const message = document.getElementById('message').value.trim();

            if (recipients.length > 0) {
              const emailRes = await fetch('/api/links/' + linkResult.link.id + '/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipients, message }),
              });

              const emailResult = await emailRes.json();
              if (emailResult.success) {
                document.getElementById('email-status').classList.remove('hidden');
              } else {
                showToast('メール送信に失敗しました: ' + emailResult.error, 'warning');
              }
            }
          }

          showToast('アップロードが完了しました', 'success');

        } catch (error) {
          console.error('Error:', error);
          showToast(error.message || 'エラーが発生しました', 'error');
          progressDiv.classList.add('hidden');
        } finally {
          submitBtn.disabled = false;
        }
      });

      // URLをコピー
      function copyUrl() {
        const urlInput = document.getElementById('download-url');
        urlInput.select();
        document.execCommand('copy');
        showToast('リンクをコピーしました', 'success');
      }

      // フォームをリセット
      function resetForm() {
        document.getElementById('upload-form').reset();
        clearFile();
        document.getElementById('upload-result').classList.add('hidden');
        document.getElementById('email-status').classList.add('hidden');
      }
    </script>
  `;

  return c.html(layout({ title: 'アップロード', user }, content));
});

export default upload;
