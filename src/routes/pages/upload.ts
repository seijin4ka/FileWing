/**
 * アップロードページ
 * ドラッグ&ドロップ対応のファイルアップロード画面
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';
import { layout } from '../../templates/layout';
import { fileDropzone, select, input, textarea } from '../../templates/components/form';
import { button } from '../../templates/components/button';
import { createTranslator } from '../../i18n';

const upload = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /upload
 * アップロード画面
 */
upload.get('/', async (c) => {
  const user = c.get('user');
  const lang = c.get('lang') || 'ja';
  const { get } = createTranslator(lang);

  const content = `
    <div class="max-w-2xl mx-auto">
      <!-- ページヘッダー -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-900">${get('upload.pageTitle')}</h1>
        <p class="text-gray-600">${get('upload.pageDescription')}</p>
      </div>

      <!-- アップロードフォーム -->
      <form id="upload-form" class="space-y-6">
        <!-- ファイル選択 -->
        ${fileDropzone({ name: 'file', accept: '*/*' })}

        <!-- オプション設定 -->
        <div class="bg-white rounded-lg shadow-sm border p-6 space-y-4">
          <h2 class="text-lg font-medium text-gray-900 mb-4">${get('upload.settings')}</h2>

          ${select({
            name: 'expires_days',
            label: get('upload.expiresIn'),
            options: [
              { value: '1', label: '1 ' + get('upload.days') },
              { value: '3', label: '3 ' + get('upload.days') },
              { value: '7', label: '7 ' + get('upload.daysRecommended') },
              { value: '10', label: '10 ' + get('upload.days') },
            ],
            value: '7',
          })}

          ${input({
            name: 'password',
            label: get('upload.passwordOptional'),
            type: 'password',
            placeholder: get('upload.passwordPlaceholder'),
            helpText: get('upload.passwordHelp'),
          })}

          ${input({
            name: 'max_downloads',
            label: get('upload.maxDownloads'),
            type: 'number',
            placeholder: get('upload.maxDownloadsPlaceholder'),
            attrs: { min: '1', max: '1000' },
            helpText: get('upload.maxDownloadsHelp'),
          })}

          ${textarea({
            name: 'recipients',
            label: get('upload.recipients'),
            placeholder: get('upload.recipientsPlaceholder'),
            rows: 3,
            helpText: get('upload.recipientsHelp'),
          })}

          ${textarea({
            name: 'message',
            label: get('upload.message'),
            placeholder: get('upload.messagePlaceholder'),
            rows: 3,
          })}
        </div>

        <!-- 送信ボタン -->
        <div class="flex items-center justify-between">
          <a href="/" class="text-gray-600 hover:text-gray-900">${get('common.cancel')}</a>
          ${button({ text: get('common.upload'), type: 'submit', variant: 'primary', size: 'lg', id: 'submit-btn' })}
        </div>
      </form>

      <!-- 進捗表示 -->
      <div id="upload-progress" class="hidden mt-6">
        <div class="bg-white rounded-lg shadow-sm border p-6">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-700">${get('upload.uploading')}</span>
            <span id="progress-percent" class="text-sm text-gray-500">0%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div id="progress-bar" class="bg-primary-600 h-2 rounded-full transition-all" style="width: 0%"></div>
          </div>
        </div>
      </div>

      <!-- 結果表示（リダイレクト中） -->
      <div id="upload-result" class="hidden mt-6">
        <div class="bg-primary-50 border border-primary-200 rounded-lg p-8">
          <div class="text-center">
            <!-- 成功アニメーション -->
            <div class="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4 animate-pulse">
              <svg class="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h3 class="text-xl font-bold text-gray-900 mb-2">${get('upload.uploadComplete')}</h3>
            <p class="text-gray-600 mb-4">${get('upload.uploadCompleteMessage')}</p>

            <!-- ダウンロードURL表示 -->
            <div class="bg-white rounded-lg p-4 mb-4 border">
              <label class="block text-sm font-medium text-gray-700 mb-2">${get('upload.downloadLink')}</label>
              <div class="flex rounded-md shadow-sm">
                <input type="text" id="download-url" readonly class="flex-1 min-w-0 block px-3 py-2 rounded-l-md border border-gray-300 bg-gray-50 text-sm font-mono" />
                <button type="button" onclick="copyUrl()" class="inline-flex items-center px-4 py-2 border border-l-0 border-gray-300 rounded-r-md bg-primary-500 text-sm font-medium text-white hover:bg-primary-600 transition-colors">
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                  </svg>
                  ${get('common.copy')}
                </button>
              </div>
            </div>

            <!-- リダイレクト案内 -->
            <div class="flex items-center justify-center text-sm text-gray-500 mb-4">
              <svg class="animate-spin h-4 w-4 mr-2 text-primary-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span id="redirect-message">${get('upload.redirecting')}</span>
            </div>

            <!-- アクションボタン -->
            <div class="flex items-center justify-center space-x-4">
              <a id="detail-link" href="/files" class="inline-flex items-center px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                ${get('upload.viewDetails')}
              </a>
              <button type="button" onclick="cancelRedirectAndReset()" class="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                ${get('upload.uploadAnother')}
              </button>
            </div>

            <div id="email-status" class="hidden mt-4">
              <p class="text-sm text-primary-700 flex items-center justify-center">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
                ${get('upload.emailSent')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <script>
      // i18n strings
      const i18n = {
        selectFile: '${get('upload.selectFile')}',
        uploadFailed: '${get('errors.uploadFailed')}',
        emailFailed: '${get('upload.emailFailed')}',
        linkCopied: '${get('common.copied')}',
        redirecting: '${get('upload.redirecting')}',
        redirectingIn: '${get('upload.redirectingIn')}',
        redirectCancelled: '${get('upload.redirectCancelled')}',
        uploadComplete: '${get('upload.uploadComplete')}',
        error: '${get('common.error')}',
      };
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
        // R2はファイルサイズ無制限のため、制限チェックは不要
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
          showToast(i18n.selectFile, 'error');
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

            xhr.onerror = () => reject(new Error(i18n.uploadFailed));
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
          const fileId = uploadResult.file.id;
          document.getElementById('download-url').value = linkResult.link.url;
          document.getElementById('detail-link').href = '/files/' + fileId;
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
                showToast(i18n.emailFailed + ': ' + emailResult.error, 'warning');
              }
            }
          }

          showToast(i18n.uploadComplete, 'success');

          // 3秒後にファイル詳細ページにリダイレクト
          startRedirectCountdown(fileId);

        } catch (error) {
          console.error('Error:', error);
          showToast(error.message || i18n.error, 'error');
          progressDiv.classList.add('hidden');
        } finally {
          submitBtn.disabled = false;
        }
      });

      // URLをコピー
      function copyUrl() {
        const urlInput = document.getElementById('download-url');
        const text = urlInput.value;
        navigator.clipboard.writeText(text).then(() => {
          showToast(i18n.linkCopied, 'success');
        }).catch(() => {
          // フォールバック (HTTPS以外の環境)
          urlInput.select();
          document.execCommand('copy');
          showToast(i18n.linkCopied, 'success');
        });
      }

      // リダイレクトタイマー
      let redirectTimer = null;
      let countdownTimer = null;

      function startRedirectCountdown(fileId) {
        let seconds = 3;
        const messageEl = document.getElementById('redirect-message');

        // カウントダウン表示を更新
        countdownTimer = setInterval(() => {
          seconds--;
          if (seconds > 0) {
            messageEl.textContent = seconds + ' ' + i18n.redirectingIn;
          } else {
            messageEl.textContent = i18n.redirecting;
          }
        }, 1000);

        // 3秒後にリダイレクト
        redirectTimer = setTimeout(() => {
          clearInterval(countdownTimer);
          window.location.href = '/files/' + fileId;
        }, 3000);
      }

      function cancelRedirect() {
        if (redirectTimer) {
          clearTimeout(redirectTimer);
          redirectTimer = null;
        }
        if (countdownTimer) {
          clearInterval(countdownTimer);
          countdownTimer = null;
        }
        document.getElementById('redirect-message').textContent = i18n.redirectCancelled;
      }

      function cancelRedirectAndReset() {
        cancelRedirect();
        resetForm();
      }

      // フォームをリセット
      function resetForm() {
        document.getElementById('upload-form').reset();
        clearFile();
        document.getElementById('upload-result').classList.add('hidden');
        document.getElementById('email-status').classList.add('hidden');
        document.getElementById('redirect-message').textContent = i18n.redirecting;
      }
    </script>
  `;

  return c.html(layout({ title: get('upload.title'), user, lang, authMethod: c.get('authMethod'), currentUrl: c.req.url }, content));
});

export default upload;
