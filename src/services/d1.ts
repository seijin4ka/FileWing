/**
 * D1データベースサービス
 * ユーザー、ファイル、リンク、ログの CRUD 操作を担当
 */

import type {
  User,
  FileRecord,
  DownloadLink,
  LinkRecipient,
  DownloadLog,
  DownloadStats,
  ReceiveLink,
  ReceivedFile,
} from '../types';

// =====================================================
// ユーザー関連
// =====================================================

/**
 * メールアドレスでユーザーを検索（なければ作成）
 */
export async function findOrCreateUser(
  db: D1Database,
  email: string,
  name?: string
): Promise<User> {
  // 既存ユーザーを検索
  const existing = await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first<User>();

  if (existing) {
    return existing;
  }

  // 新規ユーザーを作成
  const result = await db
    .prepare('INSERT INTO users (email, name) VALUES (?, ?) RETURNING *')
    .bind(email, name || null)
    .first<User>();

  if (!result) {
    throw new Error('ユーザーの作成に失敗しました');
  }

  return result;
}

/**
 * ユーザーIDでユーザーを取得
 */
export async function getUserById(
  db: D1Database,
  id: number
): Promise<User | null> {
  return await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first<User>();
}

// =====================================================
// ファイル関連
// =====================================================

/**
 * ファイルレコードを作成
 */
export async function createFile(
  db: D1Database,
  userId: number,
  r2Key: string,
  originalName: string,
  size: number,
  mimeType: string
): Promise<FileRecord> {
  const result = await db
    .prepare(
      `INSERT INTO files (user_id, r2_key, original_name, size, mime_type)
       VALUES (?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(userId, r2Key, originalName, size, mimeType)
    .first<FileRecord>();

  if (!result) {
    throw new Error('ファイルレコードの作成に失敗しました');
  }

  return result;
}

/**
 * ユーザーのファイル一覧を取得
 */
export async function getFilesByUser(
  db: D1Database,
  userId: number,
  includeDeleted = false
): Promise<FileRecord[]> {
  const query = includeDeleted
    ? 'SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC'
    : 'SELECT * FROM files WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC';

  const result = await db.prepare(query).bind(userId).all<FileRecord>();

  return result.results;
}

/**
 * ファイルIDでファイルを取得
 */
export async function getFileById(
  db: D1Database,
  fileId: number
): Promise<FileRecord | null> {
  return await db
    .prepare('SELECT * FROM files WHERE id = ? AND deleted_at IS NULL')
    .bind(fileId)
    .first<FileRecord>();
}

/**
 * ファイルを論理削除
 */
export async function softDeleteFile(
  db: D1Database,
  fileId: number,
  userId: number
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE files
       SET deleted_at = datetime('now')
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
    )
    .bind(fileId, userId)
    .run();

  return result.meta.changes > 0;
}

// =====================================================
// ダウンロードリンク関連
// =====================================================

/**
 * 推測困難なトークンを生成（64文字）
 */
export function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * ダウンロードリンクを作成
 */
export async function createDownloadLink(
  db: D1Database,
  fileId: number,
  createdBy: number,
  expiresDays: number,
  passwordHash?: string,
  maxDownloads?: number
): Promise<DownloadLink> {
  const token = generateSecureToken();

  // 有効期限を計算（1-10日に制限）
  const days = Math.min(Math.max(expiresDays, 1), 10);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const result = await db
    .prepare(
      `INSERT INTO download_links
       (file_id, token, expires_at, password_hash, max_downloads, created_by)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(
      fileId,
      token,
      expiresAt.toISOString(),
      passwordHash || null,
      maxDownloads || null,
      createdBy
    )
    .first<DownloadLink>();

  if (!result) {
    throw new Error('ダウンロードリンクの作成に失敗しました');
  }

  return result;
}

/**
 * トークンでダウンロードリンクを取得（有効なもののみ）
 */
export async function getValidLinkByToken(
  db: D1Database,
  token: string
): Promise<(DownloadLink & { file: FileRecord }) | null> {
  const link = await db
    .prepare(
      `SELECT dl.*, f.id as file_id, f.user_id, f.r2_key, f.original_name,
              f.size, f.mime_type, f.created_at as file_created_at
       FROM download_links dl
       JOIN files f ON dl.file_id = f.id
       WHERE dl.token = ?
         AND dl.disabled_at IS NULL
         AND dl.expires_at > datetime('now')
         AND f.deleted_at IS NULL
         AND (dl.max_downloads IS NULL OR dl.download_count < dl.max_downloads)`
    )
    .bind(token)
    .first<DownloadLink & {
      file_id: number;
      user_id: number;
      r2_key: string;
      original_name: string;
      size: number;
      mime_type: string;
      file_created_at: string;
    }>();

  if (!link) {
    return null;
  }

  // ファイル情報を構造化
  const file: FileRecord = {
    id: link.file_id,
    user_id: link.user_id,
    r2_key: link.r2_key,
    original_name: link.original_name,
    size: link.size,
    mime_type: link.mime_type,
    created_at: link.file_created_at,
    deleted_at: null,
  };

  return { ...link, file };
}

/**
 * ファイルのダウンロードリンク一覧を取得
 */
export async function getLinksByFile(
  db: D1Database,
  fileId: number
): Promise<DownloadLink[]> {
  const result = await db
    .prepare(
      'SELECT * FROM download_links WHERE file_id = ? ORDER BY created_at DESC'
    )
    .bind(fileId)
    .all<DownloadLink>();

  return result.results;
}

/**
 * ユーザーの全ダウンロードリンクを取得（ファイル情報付き）
 */
export async function getLinksByUser(
  db: D1Database,
  userId: number
): Promise<(DownloadLink & { file_name: string; file_size: number })[]> {
  const result = await db
    .prepare(
      `SELECT dl.*, f.original_name as file_name, f.size as file_size
       FROM download_links dl
       JOIN files f ON dl.file_id = f.id
       WHERE f.user_id = ? AND f.deleted_at IS NULL
       ORDER BY dl.created_at DESC`
    )
    .bind(userId)
    .all<DownloadLink & { file_name: string; file_size: number }>();

  return result.results;
}

/**
 * リンクIDでダウンロードリンクを取得
 */
export async function getLinkById(
  db: D1Database,
  linkId: number
): Promise<DownloadLink | null> {
  return await db
    .prepare('SELECT * FROM download_links WHERE id = ?')
    .bind(linkId)
    .first<DownloadLink>();
}

/**
 * ダウンロードリンクを無効化
 */
export async function disableLink(
  db: D1Database,
  linkId: number,
  userId: number
): Promise<boolean> {
  // リンクが指定ユーザーのファイルに属しているか確認
  const result = await db
    .prepare(
      `UPDATE download_links
       SET disabled_at = datetime('now')
       WHERE id = ?
         AND disabled_at IS NULL
         AND file_id IN (SELECT id FROM files WHERE user_id = ?)`
    )
    .bind(linkId, userId)
    .run();

  return result.meta.changes > 0;
}

/**
 * ファイルに紐づく全リンクを完全削除
 * 関連する送信先履歴・ダウンロード履歴も削除
 */
export async function deleteLinksByFile(
  db: D1Database,
  fileId: number
): Promise<number> {
  // ファイルに紐づくリンクIDを取得
  const links = await db
    .prepare('SELECT id FROM download_links WHERE file_id = ?')
    .bind(fileId)
    .all<{ id: number }>();

  if (links.results.length === 0) {
    return 0;
  }

  const linkIds = links.results.map((l) => l.id);

  // 関連データを削除（バッチ処理）
  const deleteRecipients = db.prepare('DELETE FROM link_recipients WHERE link_id = ?');
  const deleteLogs = db.prepare('DELETE FROM download_logs WHERE link_id = ?');
  const deleteLink = db.prepare('DELETE FROM download_links WHERE id = ?');

  // 各リンクの関連データを削除
  await db.batch([
    ...linkIds.map((id) => deleteRecipients.bind(id)),
    ...linkIds.map((id) => deleteLogs.bind(id)),
    ...linkIds.map((id) => deleteLink.bind(id)),
  ]);

  return linkIds.length;
}

/**
 * ダウンロード回数をインクリメント
 * max_downloadsに達した場合は自動的にリンクを無効化
 */
export async function incrementDownloadCount(
  db: D1Database,
  linkId: number
): Promise<void> {
  // ダウンロードカウントをインクリメント
  await db
    .prepare(
      'UPDATE download_links SET download_count = download_count + 1 WHERE id = ?'
    )
    .bind(linkId)
    .run();

  // max_downloadsに達したらリンクを無効化
  await db
    .prepare(
      `UPDATE download_links
       SET disabled_at = datetime('now')
       WHERE id = ?
         AND max_downloads IS NOT NULL
         AND download_count >= max_downloads
         AND disabled_at IS NULL`
    )
    .bind(linkId)
    .run();
}

// =====================================================
// リンク送信先関連
// =====================================================

/**
 * 送信先を記録
 */
export async function addLinkRecipients(
  db: D1Database,
  linkId: number,
  emails: string[]
): Promise<void> {
  const stmt = db.prepare(
    'INSERT INTO link_recipients (link_id, email) VALUES (?, ?)'
  );

  await db.batch(emails.map((email) => stmt.bind(linkId, email)));
}

/**
 * リンクの送信先一覧を取得
 */
export async function getRecipientsByLink(
  db: D1Database,
  linkId: number
): Promise<LinkRecipient[]> {
  const result = await db
    .prepare('SELECT * FROM link_recipients WHERE link_id = ? ORDER BY sent_at')
    .bind(linkId)
    .all<LinkRecipient>();

  return result.results;
}

// =====================================================
// ダウンロード履歴関連
// =====================================================

/**
 * ダウンロード履歴を記録
 */
export async function logDownload(
  db: D1Database,
  linkId: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO download_logs (link_id, ip_address, user_agent) VALUES (?, ?, ?)'
    )
    .bind(linkId, ipAddress || null, userAgent || null)
    .run();
}

/**
 * リンクのダウンロード履歴を取得
 */
export async function getDownloadLogs(
  db: D1Database,
  linkId: number,
  limit = 100
): Promise<DownloadLog[]> {
  const result = await db
    .prepare(
      'SELECT * FROM download_logs WHERE link_id = ? ORDER BY downloaded_at DESC LIMIT ?'
    )
    .bind(linkId, limit)
    .all<DownloadLog>();

  return result.results;
}

/**
 * リンクのダウンロード統計を取得
 */
export async function getDownloadStats(
  db: D1Database,
  linkId: number
): Promise<DownloadStats> {
  // 基本統計
  const stats = await db
    .prepare(
      `SELECT
         COUNT(*) as total_downloads,
         COUNT(DISTINCT ip_address) as unique_ips
       FROM download_logs
       WHERE link_id = ?`
    )
    .bind(linkId)
    .first<{ total_downloads: number; unique_ips: number }>();

  // 最近のログ
  const recentLogs = await getDownloadLogs(db, linkId, 10);

  // 送信先
  const recipients = await getRecipientsByLink(db, linkId);

  return {
    link_id: linkId,
    total_downloads: stats?.total_downloads || 0,
    unique_ips: stats?.unique_ips || 0,
    recent_logs: recentLogs,
    recipients,
  };
}

// =====================================================
// ダッシュボード用統計
// =====================================================

/**
 * ユーザーの統計情報を取得
 */
export async function getUserStats(
  db: D1Database,
  userId: number
): Promise<{
  total_files: number;
  total_size: number;
  active_links: number;
  total_downloads: number;
}> {
  const stats = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM files WHERE user_id = ? AND deleted_at IS NULL) as total_files,
         (SELECT COALESCE(SUM(size), 0) FROM files WHERE user_id = ? AND deleted_at IS NULL) as total_size,
         (SELECT COUNT(*) FROM download_links dl
          JOIN files f ON dl.file_id = f.id
          WHERE f.user_id = ? AND dl.disabled_at IS NULL AND dl.expires_at > datetime('now')) as active_links,
         (SELECT COALESCE(SUM(dl.download_count), 0) FROM download_links dl
          JOIN files f ON dl.file_id = f.id
          WHERE f.user_id = ?) as total_downloads`
    )
    .bind(userId, userId, userId, userId)
    .first<{
      total_files: number;
      total_size: number;
      active_links: number;
      total_downloads: number;
    }>();

  return {
    total_files: stats?.total_files || 0,
    total_size: stats?.total_size || 0,
    active_links: stats?.active_links || 0,
    total_downloads: stats?.total_downloads || 0,
  };
}

/**
 * 最近のアクティビティを取得
 */
export async function getRecentActivity(
  db: D1Database,
  userId: number,
  limit = 10
): Promise<
  Array<{
    type: 'upload' | 'download' | 'link_created';
    file_name: string;
    created_at: string;
    details?: string;
  }>
> {
  // 最近のアップロード
  const uploads = await db
    .prepare(
      `SELECT 'upload' as type, original_name as file_name, created_at, NULL as details
       FROM files
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(userId, limit)
    .all<{
      type: 'upload';
      file_name: string;
      created_at: string;
      details: null;
    }>();

  // 最近のダウンロード
  const downloads = await db
    .prepare(
      `SELECT 'download' as type, f.original_name as file_name,
              dl_log.downloaded_at as created_at, dl_log.ip_address as details
       FROM download_logs dl_log
       JOIN download_links dl ON dl_log.link_id = dl.id
       JOIN files f ON dl.file_id = f.id
       WHERE f.user_id = ?
       ORDER BY dl_log.downloaded_at DESC
       LIMIT ?`
    )
    .bind(userId, limit)
    .all<{
      type: 'download';
      file_name: string;
      created_at: string;
      details: string | null;
    }>();

  // マージしてソート
  const activities: Array<{
    type: 'upload' | 'download' | 'link_created';
    file_name: string;
    created_at: string;
    details?: string;
  }> = [
    ...uploads.results.map((u) => ({
      type: 'upload' as const,
      file_name: u.file_name,
      created_at: u.created_at,
      details: undefined,
    })),
    ...downloads.results.map((d) => ({
      type: 'download' as const,
      file_name: d.file_name,
      created_at: d.created_at,
      details: d.details || undefined,
    })),
  ];

  activities.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return activities.slice(0, limit);
}

// =====================================================
// 受信リンク関連
// =====================================================

/**
 * 受信リンクを作成
 */
export async function createReceiveLink(
  db: D1Database,
  userId: number,
  expiresDays: number,
  title?: string,
  passwordHash?: string,
  maxFiles?: number,
  maxFileSize?: number
): Promise<ReceiveLink> {
  const token = generateSecureToken();

  // 有効期限を計算（1-10日に制限）
  const days = Math.min(Math.max(expiresDays, 1), 10);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const result = await db
    .prepare(
      `INSERT INTO receive_links
       (user_id, token, title, expires_at, max_files, max_file_size, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(
      userId,
      token,
      title || null,
      expiresAt.toISOString(),
      maxFiles || null,
      maxFileSize || null,
      passwordHash || null
    )
    .first<ReceiveLink>();

  if (!result) {
    throw new Error('受信リンクの作成に失敗しました');
  }

  return result;
}

/**
 * トークンで有効な受信リンクを取得
 */
export async function getValidReceiveLinkByToken(
  db: D1Database,
  token: string
): Promise<ReceiveLink | null> {
  return await db
    .prepare(
      `SELECT * FROM receive_links
       WHERE token = ?
         AND disabled_at IS NULL
         AND expires_at > datetime('now')`
    )
    .bind(token)
    .first<ReceiveLink>();
}

/**
 * ユーザーの受信リンク一覧を取得
 */
export async function getReceiveLinksByUser(
  db: D1Database,
  userId: number
): Promise<ReceiveLink[]> {
  const result = await db
    .prepare(
      'SELECT * FROM receive_links WHERE user_id = ? ORDER BY created_at DESC'
    )
    .bind(userId)
    .all<ReceiveLink>();

  return result.results;
}

/**
 * 受信リンクIDで取得
 */
export async function getReceiveLinkById(
  db: D1Database,
  linkId: number
): Promise<ReceiveLink | null> {
  return await db
    .prepare('SELECT * FROM receive_links WHERE id = ?')
    .bind(linkId)
    .first<ReceiveLink>();
}

/**
 * 受信リンクを無効化
 */
export async function disableReceiveLink(
  db: D1Database,
  linkId: number,
  userId: number
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE receive_links
       SET disabled_at = datetime('now')
       WHERE id = ? AND user_id = ? AND disabled_at IS NULL`
    )
    .bind(linkId, userId)
    .run();

  return result.meta.changes > 0;
}

/**
 * 受信ファイルを作成
 */
export async function createReceivedFile(
  db: D1Database,
  receiveLinkId: number,
  r2Key: string,
  originalName: string,
  size: number,
  mimeType: string,
  senderName?: string,
  senderEmail?: string,
  message?: string,
  ipAddress?: string
): Promise<ReceivedFile> {
  const result = await db
    .prepare(
      `INSERT INTO received_files
       (receive_link_id, r2_key, original_name, size, mime_type, sender_name, sender_email, message, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(
      receiveLinkId,
      r2Key,
      originalName,
      size,
      mimeType,
      senderName || null,
      senderEmail || null,
      message || null,
      ipAddress || null
    )
    .first<ReceivedFile>();

  if (!result) {
    throw new Error('受信ファイルの記録に失敗しました');
  }

  return result;
}

/**
 * 受信リンクのファイル一覧を取得
 */
export async function getReceivedFilesByLink(
  db: D1Database,
  receiveLinkId: number
): Promise<ReceivedFile[]> {
  const result = await db
    .prepare(
      'SELECT * FROM received_files WHERE receive_link_id = ? ORDER BY uploaded_at DESC'
    )
    .bind(receiveLinkId)
    .all<ReceivedFile>();

  return result.results;
}

/**
 * 受信リンクのファイル数を取得
 */
export async function getReceivedFileCount(
  db: D1Database,
  receiveLinkId: number
): Promise<number> {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM received_files WHERE receive_link_id = ?')
    .bind(receiveLinkId)
    .first<{ count: number }>();

  return result?.count || 0;
}

/**
 * 受信ファイルをIDで取得
 */
export async function getReceivedFileById(
  db: D1Database,
  fileId: number
): Promise<ReceivedFile | null> {
  return await db
    .prepare('SELECT * FROM received_files WHERE id = ?')
    .bind(fileId)
    .first<ReceivedFile>();
}

/**
 * 受信ファイルのダウンロード済みを記録
 */
export async function markReceivedFileDownloaded(
  db: D1Database,
  fileId: number
): Promise<void> {
  await db
    .prepare(
      `UPDATE received_files SET downloaded_at = datetime('now') WHERE id = ?`
    )
    .bind(fileId)
    .run();
}

/**
 * 受信ファイルを削除
 */
export async function deleteReceivedFile(
  db: D1Database,
  fileId: number
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM received_files WHERE id = ?')
    .bind(fileId)
    .run();

  return result.meta.changes > 0;
}

/**
 * 受信リンクとその全ファイルを削除
 * R2キーのリストを返す（R2からの削除は呼び出し元で行う）
 */
export async function deleteReceiveLinkWithFiles(
  db: D1Database,
  linkId: number,
  userId: number
): Promise<{ deleted: boolean; r2Keys: string[] }> {
  // 所有者確認
  const link = await getReceiveLinkById(db, linkId);
  if (!link || link.user_id !== userId) {
    return { deleted: false, r2Keys: [] };
  }

  // 受信ファイルのR2キーを取得
  const files = await getReceivedFilesByLink(db, linkId);
  const r2Keys = files.map((f) => f.r2_key);

  // 受信ファイルを削除
  await db
    .prepare('DELETE FROM received_files WHERE receive_link_id = ?')
    .bind(linkId)
    .run();

  // 受信リンクを削除
  const result = await db
    .prepare('DELETE FROM receive_links WHERE id = ?')
    .bind(linkId)
    .run();

  return { deleted: result.meta.changes > 0, r2Keys };
}

// =====================================================
// クリーンアップ関連
// =====================================================

/**
 * 削除対象のファイル（R2キー）を取得
 * - すべてのリンクが無効化または期限切れのファイル
 * - deleted_atが設定されていないファイルのみ
 */
export async function getFilesToCleanup(
  db: D1Database
): Promise<Array<{ id: number; r2_key: string }>> {
  const result = await db
    .prepare(
      `SELECT f.id, f.r2_key
       FROM files f
       WHERE f.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM download_links dl
           WHERE dl.file_id = f.id
             AND dl.disabled_at IS NULL
             AND dl.expires_at > datetime('now')
             AND (dl.max_downloads IS NULL OR dl.download_count < dl.max_downloads)
         )`
    )
    .all<{ id: number; r2_key: string }>();

  return result.results;
}

/**
 * ファイルのR2キーが削除対象か確認
 * すべてのリンクが無効化または期限切れまたは回数制限に達している場合true
 */
export async function shouldDeleteFile(
  db: D1Database,
  fileId: number
): Promise<boolean> {
  const result = await db
    .prepare(
      `SELECT COUNT(*) as active_links
       FROM download_links
       WHERE file_id = ?
         AND disabled_at IS NULL
         AND expires_at > datetime('now')
         AND (max_downloads IS NULL OR download_count < max_downloads)`
    )
    .bind(fileId)
    .first<{ active_links: number }>();

  return (result?.active_links || 0) === 0;
}

/**
 * ファイルを論理削除（deleted_atを設定）
 */
export async function markFileDeleted(
  db: D1Database,
  fileId: number
): Promise<void> {
  await db
    .prepare(
      `UPDATE files SET deleted_at = datetime('now') WHERE id = ?`
    )
    .bind(fileId)
    .run();
}

/**
 * 孤児リンクをクリーンアップ（ファイルが削除されているリンクを完全削除）
 */
export async function cleanupOrphanLinks(db: D1Database): Promise<number> {
  // 削除済みファイルに紐づくリンクIDを取得
  const orphanLinks = await db
    .prepare(
      `SELECT dl.id FROM download_links dl
       JOIN files f ON dl.file_id = f.id
       WHERE f.deleted_at IS NOT NULL`
    )
    .all<{ id: number }>();

  if (orphanLinks.results.length === 0) {
    return 0;
  }

  const linkIds = orphanLinks.results.map((l) => l.id);

  // 関連データを削除（バッチ処理）
  const deleteRecipients = db.prepare('DELETE FROM link_recipients WHERE link_id = ?');
  const deleteLogs = db.prepare('DELETE FROM download_logs WHERE link_id = ?');
  const deleteLink = db.prepare('DELETE FROM download_links WHERE id = ?');

  await db.batch([
    ...linkIds.map((id) => deleteRecipients.bind(id)),
    ...linkIds.map((id) => deleteLogs.bind(id)),
    ...linkIds.map((id) => deleteLink.bind(id)),
  ]);

  return linkIds.length;
}

/**
 * 受信ファイルの削除対象を取得
 * - リンクが無効化または期限切れ
 */
export async function getReceivedFilesToCleanup(
  db: D1Database
): Promise<Array<{ id: number; r2_key: string }>> {
  const result = await db
    .prepare(
      `SELECT rf.id, rf.r2_key
       FROM received_files rf
       JOIN receive_links rl ON rf.receive_link_id = rl.id
       WHERE rf.downloaded_at IS NOT NULL
         AND (rl.disabled_at IS NOT NULL OR rl.expires_at <= datetime('now'))`
    )
    .all<{ id: number; r2_key: string }>();

  return result.results;
}

// =====================================================
// コスト見積もり用統計
// =====================================================

/**
 * システム全体の使用量統計を取得（コスト見積もり用）
 */
export async function getSystemUsageStats(
  db: D1Database
): Promise<{
  totalStorageBytes: number;
  fileCount: number;
  uploadsThisMonth: number;
  downloadsThisMonth: number;
  receivedFilesCount: number;
  receivedStorageBytes: number;
}> {
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);
  const monthStart = firstOfMonth.toISOString();

  const stats = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM files WHERE deleted_at IS NULL) as file_count,
         (SELECT COALESCE(SUM(size), 0) FROM files WHERE deleted_at IS NULL) as total_storage,
         (SELECT COUNT(*) FROM files WHERE created_at >= ?) as uploads_this_month,
         (SELECT COALESCE(SUM(download_count), 0) FROM download_links WHERE created_at >= ?) as downloads_this_month,
         (SELECT COUNT(*) FROM received_files) as received_files_count,
         (SELECT COALESCE(SUM(size), 0) FROM received_files) as received_storage`
    )
    .bind(monthStart, monthStart)
    .first<{
      file_count: number;
      total_storage: number;
      uploads_this_month: number;
      downloads_this_month: number;
      received_files_count: number;
      received_storage: number;
    }>();

  return {
    totalStorageBytes: (stats?.total_storage || 0) + (stats?.received_storage || 0),
    fileCount: (stats?.file_count || 0) + (stats?.received_files_count || 0),
    uploadsThisMonth: stats?.uploads_this_month || 0,
    downloadsThisMonth: stats?.downloads_this_month || 0,
    receivedFilesCount: stats?.received_files_count || 0,
    receivedStorageBytes: stats?.received_storage || 0,
  };
}

/**
 * ユーザー別の使用量統計を取得
 */
export async function getUserUsageStats(
  db: D1Database,
  userId: number
): Promise<{
  totalStorageBytes: number;
  fileCount: number;
  uploadsThisMonth: number;
  downloadsThisMonth: number;
}> {
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);
  const monthStart = firstOfMonth.toISOString();

  const stats = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM files WHERE user_id = ? AND deleted_at IS NULL) as file_count,
         (SELECT COALESCE(SUM(size), 0) FROM files WHERE user_id = ? AND deleted_at IS NULL) as total_storage,
         (SELECT COUNT(*) FROM files WHERE user_id = ? AND created_at >= ?) as uploads_this_month,
         (SELECT COALESCE(SUM(dl.download_count), 0)
          FROM download_links dl
          JOIN files f ON dl.file_id = f.id
          WHERE f.user_id = ? AND dl.created_at >= ?) as downloads_this_month`
    )
    .bind(userId, userId, userId, monthStart, userId, monthStart)
    .first<{
      file_count: number;
      total_storage: number;
      uploads_this_month: number;
      downloads_this_month: number;
    }>();

  return {
    totalStorageBytes: stats?.total_storage || 0,
    fileCount: stats?.file_count || 0,
    uploadsThisMonth: stats?.uploads_this_month || 0,
    downloadsThisMonth: stats?.downloads_this_month || 0,
  };
}

/**
 * ユーザーのファイルをリンク統計と共に取得（N+1 解消）
 */
export async function getFilesWithLinkStatsByUser(
  db: D1Database,
  userId: number
): Promise<(FileRecord & { active_link_count: number; total_downloads: number })[]> {
  const result = await db
    .prepare(`
      SELECT f.*,
             COUNT(CASE WHEN dl.disabled_at IS NULL AND dl.expires_at > datetime('now') THEN 1 END) as active_link_count,
             COALESCE(SUM(dl.download_count), 0) as total_downloads
      FROM files f
      LEFT JOIN download_links dl ON dl.file_id = f.id
      WHERE f.user_id = ? AND f.deleted_at IS NULL
      GROUP BY f.id
      ORDER BY f.created_at DESC
    `)
    .bind(userId)
    .all<FileRecord & { active_link_count: number; total_downloads: number }>();

  return result.results;
}

/**
 * ユーザーの受信リンクを統計と共に取得（N+1 解消）
 */
export async function getReceiveLinksWithStatsByUser(
  db: D1Database,
  userId: number
): Promise<(ReceiveLink & { received_file_count: number })[]> {
  const result = await db
    .prepare(`
      SELECT rl.*,
             COUNT(rf.id) as received_file_count
      FROM receive_links rl
      LEFT JOIN received_files rf ON rf.receive_link_id = rl.id
      WHERE rl.user_id = ?
      GROUP BY rl.id
      ORDER BY rl.created_at DESC
    `)
    .bind(userId)
    .all<ReceiveLink & { received_file_count: number }>();

  return result.results;
}

// =====================================================
// ローカル認証（管理者登録方式）
// =====================================================

/**
 * 管理者ユーザーが既に登録されているかを判定
 */
export async function hasAdminUser(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 as found FROM users WHERE role = 'admin' LIMIT 1")
    .first<{ found: number }>();

  return row !== null;
}

/**
 * メールアドレスでユーザーを検索（作成はしない）
 */
export async function findUserByEmail(
  db: D1Database,
  email: string
): Promise<User | null> {
  const user = await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first<User>();

  return user ?? null;
}

/**
 * 最初の管理者ユーザーを作成
 *
 * 管理者が既に存在する場合は作成せず null を返す。
 * 判定と挿入を1文のSQLで行うため、同時リクエストで
 * 複数の管理者が登録されることはない。
 */
export async function createFirstAdminUser(
  db: D1Database,
  email: string,
  name: string | null,
  passwordHash: string
): Promise<User | null> {
  const user = await db
    .prepare(
      `INSERT INTO users (email, name, password_hash, role)
       SELECT ?, ?, ?, 'admin'
       WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin')
       RETURNING *`
    )
    .bind(email, name, passwordHash)
    .first<User>();

  return user ?? null;
}

/**
 * 管理者が未登録の場合、指定ユーザーを作成して管理者に昇格させる
 *
 * SAML認証で最初にログインしたユーザーを管理者にするために使用する。
 * 既に管理者が存在する場合は何もしない（通常のユーザーとして扱う）。
 */
export async function promoteFirstUserToAdmin(
  db: D1Database,
  email: string,
  name: string | null
): Promise<void> {
  if (await hasAdminUser(db)) {
    return;
  }

  const existing = await findUserByEmail(db, email);

  if (existing) {
    await db
      .prepare("UPDATE users SET role = 'admin' WHERE id = ? AND role != 'admin'")
      .bind(existing.id)
      .run();
    return;
  }

  await db
    .prepare(
      `INSERT INTO users (email, name, role)
       SELECT ?, ?, 'admin'
       WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin')`
    )
    .bind(email, name)
    .run();
}
