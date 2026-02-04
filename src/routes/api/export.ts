/**
 * CSVエクスポートAPI
 * 送受信履歴をCSV形式でエクスポート
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';
import {
  getFilesByUser,
  getLinksByFile,
  getDownloadLogs,
  getReceiveLinksByUser,
  getReceivedFilesByLink,
} from '../../services/d1';

const exportApi = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /api/export/files
 * ファイル一覧をCSVエクスポート
 */
exportApi.get('/export/files', async (c) => {
  const userId = c.get('userId');

  try {
    const files = await getFilesByUser(c.env.DB, userId);

    // CSVヘッダー
    const headers = ['ID', 'ファイル名', 'サイズ(バイト)', 'MIMEタイプ', '作成日時', '削除日時'];

    // CSVデータ
    const rows = files.map((file) => [
      file.id.toString(),
      escapeCsvField(file.original_name),
      file.size.toString(),
      file.mime_type,
      file.created_at,
      file.deleted_at || '',
    ]);

    const csv = generateCsv(headers, rows);

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="files_${formatDateForFilename()}.csv"`,
      },
    });
  } catch (error) {
    console.error('ファイルCSVエクスポートエラー:', error);
    return c.json({ success: false, error: 'エクスポートに失敗しました' }, 500);
  }
});

/**
 * GET /api/export/downloads
 * ダウンロード履歴をCSVエクスポート
 */
exportApi.get('/export/downloads', async (c) => {
  const userId = c.get('userId');

  try {
    const files = await getFilesByUser(c.env.DB, userId);

    // 全ファイルのダウンロード履歴を収集
    const allLogs: Array<{
      file_name: string;
      link_id: number;
      ip_address: string;
      user_agent: string;
      downloaded_at: string;
    }> = [];

    for (const file of files) {
      const links = await getLinksByFile(c.env.DB, file.id);
      for (const link of links) {
        const logs = await getDownloadLogs(c.env.DB, link.id, 1000);
        for (const log of logs) {
          allLogs.push({
            file_name: file.original_name,
            link_id: link.id,
            ip_address: log.ip_address || '',
            user_agent: log.user_agent || '',
            downloaded_at: log.downloaded_at,
          });
        }
      }
    }

    // 日時でソート
    allLogs.sort((a, b) => new Date(b.downloaded_at).getTime() - new Date(a.downloaded_at).getTime());

    // CSVヘッダー
    const headers = ['ファイル名', 'リンクID', 'IPアドレス', 'ユーザーエージェント', 'ダウンロード日時'];

    // CSVデータ
    const rows = allLogs.map((log) => [
      escapeCsvField(log.file_name),
      log.link_id.toString(),
      log.ip_address,
      escapeCsvField(log.user_agent),
      log.downloaded_at,
    ]);

    const csv = generateCsv(headers, rows);

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="downloads_${formatDateForFilename()}.csv"`,
      },
    });
  } catch (error) {
    console.error('ダウンロード履歴CSVエクスポートエラー:', error);
    return c.json({ success: false, error: 'エクスポートに失敗しました' }, 500);
  }
});

/**
 * GET /api/export/received
 * 受信ファイル履歴をCSVエクスポート
 */
exportApi.get('/export/received', async (c) => {
  const userId = c.get('userId');

  try {
    const links = await getReceiveLinksByUser(c.env.DB, userId);

    // 全受信ファイルを収集
    const allFiles: Array<{
      link_title: string;
      file_name: string;
      size: number;
      sender_name: string;
      sender_email: string;
      message: string;
      ip_address: string;
      uploaded_at: string;
      downloaded_at: string;
    }> = [];

    for (const link of links) {
      const files = await getReceivedFilesByLink(c.env.DB, link.id);
      for (const file of files) {
        allFiles.push({
          link_title: link.title || `リンク #${link.id}`,
          file_name: file.original_name,
          size: file.size,
          sender_name: file.sender_name || '',
          sender_email: file.sender_email || '',
          message: file.message || '',
          ip_address: file.ip_address || '',
          uploaded_at: file.uploaded_at,
          downloaded_at: file.downloaded_at || '',
        });
      }
    }

    // 日時でソート
    allFiles.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

    // CSVヘッダー
    const headers = [
      '受信リンク',
      'ファイル名',
      'サイズ(バイト)',
      '送信者名',
      '送信者メール',
      'メッセージ',
      'IPアドレス',
      '受信日時',
      'ダウンロード日時',
    ];

    // CSVデータ
    const rows = allFiles.map((file) => [
      escapeCsvField(file.link_title),
      escapeCsvField(file.file_name),
      file.size.toString(),
      escapeCsvField(file.sender_name),
      file.sender_email,
      escapeCsvField(file.message),
      file.ip_address,
      file.uploaded_at,
      file.downloaded_at,
    ]);

    const csv = generateCsv(headers, rows);

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="received_${formatDateForFilename()}.csv"`,
      },
    });
  } catch (error) {
    console.error('受信ファイルCSVエクスポートエラー:', error);
    return c.json({ success: false, error: 'エクスポートに失敗しました' }, 500);
  }
});

/**
 * CSV生成
 */
function generateCsv(headers: string[], rows: string[][]): string {
  // BOM付きUTF-8
  const bom = '\uFEFF';
  const headerLine = headers.join(',');
  const dataLines = rows.map((row) => row.join(','));
  return bom + [headerLine, ...dataLines].join('\r\n');
}

/**
 * CSVフィールドをエスケープ
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * ファイル名用の日時フォーマット
 */
function formatDateForFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}_${hour}${minute}`;
}

export default exportApi;
