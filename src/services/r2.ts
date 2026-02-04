/**
 * R2ストレージサービス
 * ファイルのアップロード・ダウンロード・削除を担当
 */

/**
 * ファイルをR2にアップロード
 * @param bucket R2バケット
 * @param key ストレージキー（ユニークID）
 * @param data ファイルデータ
 * @param contentType MIMEタイプ
 */
export async function uploadFile(
  bucket: R2Bucket,
  key: string,
  data: ArrayBuffer | ReadableStream,
  contentType: string
): Promise<R2Object> {
  return await bucket.put(key, data, {
    httpMetadata: {
      contentType,
    },
  });
}

/**
 * R2からファイルを取得
 * @param bucket R2バケット
 * @param key ストレージキー
 * @returns ファイルオブジェクト（存在しない場合はnull）
 */
export async function getFile(
  bucket: R2Bucket,
  key: string
): Promise<R2ObjectBody | null> {
  return await bucket.get(key);
}

/**
 * R2からファイルを削除
 * @param bucket R2バケット
 * @param key ストレージキー
 */
export async function deleteFile(
  bucket: R2Bucket,
  key: string
): Promise<void> {
  await bucket.delete(key);
}

/**
 * ユニークなR2キーを生成
 * 形式: {userId}/{timestamp}-{randomId}/{sanitizedFilename}
 * @param userId ユーザーID
 * @param originalName 元のファイル名
 */
export function generateR2Key(userId: number, originalName: string): string {
  const timestamp = Date.now();
  const randomId = crypto.randomUUID();
  // ファイル名をサニタイズ（危険な文字を除去）
  const sanitized = sanitizeFilename(originalName);
  return `${userId}/${timestamp}-${randomId}/${sanitized}`;
}

/**
 * ファイル名をサニタイズ
 * パストラバーサルや特殊文字を除去
 */
export function sanitizeFilename(filename: string): string {
  // パス区切り文字を除去
  let sanitized = filename.replace(/[/\\]/g, '_');
  // 制御文字を除去
  sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, '');
  // 連続するドットを除去（..を防ぐ）
  sanitized = sanitized.replace(/\.{2,}/g, '.');
  // 先頭・末尾のドットとスペースを除去
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');
  // 空になった場合はデフォルト名
  if (!sanitized) {
    sanitized = 'unnamed_file';
  }
  return sanitized;
}

/**
 * MIMEタイプを推測
 * Content-Typeヘッダーがない場合のフォールバック
 */
export function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    // ドキュメント
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    // 画像
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    // 圧縮ファイル
    zip: 'application/zip',
    gz: 'application/gzip',
    tar: 'application/x-tar',
    rar: 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    // その他
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}
