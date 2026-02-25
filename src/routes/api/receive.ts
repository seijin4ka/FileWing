/**
 * 受信リンク管理API
 * 外部ユーザーからファイルを受け取るためのリンク管理
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';
import {
  createReceiveLink,
  getReceiveLinkById,
  disableReceiveLink,
  getReceivedFilesByLink,
  getReceivedFileById,
  markReceivedFileDownloaded,
  deleteReceivedFile,
  deleteReceiveLinkWithFiles,
  getReceiveLinksWithStatsByUser,
} from '../../services/d1';
import { getFile, deleteFile } from '../../services/r2';
import { hashPassword } from '../../utils/crypto';

const receive = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * POST /api/receive-links
 * 受信リンクを作成
 */
receive.post('/receive-links', async (c) => {
  const userId = c.get('userId');

  try {
    const body = await c.req.json<{
      title?: string;
      expires_days?: number;
      password?: string;
      max_files?: number;
      max_file_size?: number;
    }>();

    const expiresDays = body.expires_days || 7;

    // パスワードハッシュ（PBKDF2 + ソルトで強力なハッシュを生成）
    let passwordHash: string | undefined;
    if (body.password) {
      passwordHash = await hashPassword(body.password);
    }

    const link = await createReceiveLink(
      c.env.DB,
      userId,
      expiresDays,
      body.title,
      passwordHash,
      body.max_files,
      body.max_file_size
    );

    // URLを生成
    const url = new URL(c.req.url);
    const receiveUrl = `${url.origin}/r/${link.token}`;

    return c.json({
      success: true,
      link: { ...link, url: receiveUrl },
    });
  } catch (error) {
    console.error('受信リンク作成エラー:', error);
    return c.json(
      { success: false, error: '受信リンクの作成に失敗しました' },
      500
    );
  }
});

/**
 * GET /api/receive-links
 * 受信リンク一覧を取得
 */
receive.get('/receive-links', async (c) => {
  const userId = c.get('userId');

  try {
    // 受信リンク一覧を統計と共に取得（N+1解消）
    const linksWithStatsBase = await getReceiveLinksWithStatsByUser(c.env.DB, userId);

    // is_active フラグとプロパティ名を調整して返却
    const linksWithCount = linksWithStatsBase.map((link) => ({
      ...link,
      file_count: link.received_file_count,
      is_active: !link.disabled_at && new Date(link.expires_at) > new Date(),
    }));

    return c.json({
      success: true,
      links: linksWithCount,
    });
  } catch (error) {
    console.error('受信リンク一覧取得エラー:', error);
    return c.json(
      { success: false, error: '受信リンク一覧の取得に失敗しました' },
      500
    );
  }
});

/**
 * GET /api/receive-links/:id
 * 受信リンク詳細を取得
 */
receive.get('/receive-links/:id', async (c) => {
  const userId = c.get('userId');
  const linkId = parseInt(c.req.param('id'), 10);

  if (isNaN(linkId)) {
    return c.json({ success: false, error: '無効なリンクIDです' }, 400);
  }

  try {
    const link = await getReceiveLinkById(c.env.DB, linkId);

    if (!link) {
      return c.json({ success: false, error: 'リンクが見つかりません' }, 404);
    }

    if (link.user_id !== userId) {
      return c.json({ success: false, error: 'アクセス権限がありません' }, 403);
    }

    // 受信ファイル一覧を取得
    const files = await getReceivedFilesByLink(c.env.DB, linkId);

    // URLを生成
    const url = new URL(c.req.url);
    const receiveUrl = `${url.origin}/r/${link.token}`;

    return c.json({
      success: true,
      link: { ...link, url: receiveUrl },
      files,
    });
  } catch (error) {
    console.error('受信リンク詳細取得エラー:', error);
    return c.json(
      { success: false, error: '受信リンク詳細の取得に失敗しました' },
      500
    );
  }
});

/**
 * DELETE /api/receive-links/:id
 * 受信リンクを無効化
 */
receive.delete('/receive-links/:id', async (c) => {
  const userId = c.get('userId');
  const linkId = parseInt(c.req.param('id'), 10);

  if (isNaN(linkId)) {
    return c.json({ success: false, error: '無効なリンクIDです' }, 400);
  }

  try {
    const disabled = await disableReceiveLink(c.env.DB, linkId, userId);

    if (!disabled) {
      return c.json(
        { success: false, error: 'リンクが見つからないか、既に無効化されています' },
        404
      );
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('受信リンク無効化エラー:', error);
    return c.json(
      { success: false, error: '受信リンクの無効化に失敗しました' },
      500
    );
  }
});

/**
 * GET /api/received-files/:id/download
 * 受信ファイルをダウンロード
 */
receive.get('/received-files/:id/download', async (c) => {
  const userId = c.get('userId');
  const fileId = parseInt(c.req.param('id'), 10);

  if (isNaN(fileId)) {
    return c.json({ success: false, error: '無効なファイルIDです' }, 400);
  }

  try {
    const file = await getReceivedFileById(c.env.DB, fileId);

    if (!file) {
      return c.json({ success: false, error: 'ファイルが見つかりません' }, 404);
    }

    // リンクの所有者チェック
    const link = await getReceiveLinkById(c.env.DB, file.receive_link_id);
    if (!link || link.user_id !== userId) {
      return c.json({ success: false, error: 'アクセス権限がありません' }, 403);
    }

    // R2からファイルを取得
    const r2Object = await getFile(c.env.R2_BUCKET, file.r2_key);

    if (!r2Object) {
      return c.json({ success: false, error: 'ファイルが見つかりません' }, 404);
    }

    // ダウンロード済みを記録
    await markReceivedFileDownloaded(c.env.DB, fileId);

    // ファイル名をエンコード
    const encodedFilename = encodeURIComponent(file.original_name)
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29');

    const headers = new Headers();
    headers.set('Content-Type', file.mime_type);
    headers.set(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodedFilename}`
    );
    headers.set('Content-Length', file.size.toString());

    return new Response(r2Object.body, { headers });
  } catch (error) {
    console.error('ファイルダウンロードエラー:', error);
    return c.json(
      { success: false, error: 'ダウンロードに失敗しました' },
      500
    );
  }
});

/**
 * DELETE /api/received-files/:id
 * 受信ファイルを削除
 */
receive.delete('/received-files/:id', async (c) => {
  const userId = c.get('userId');
  const fileId = parseInt(c.req.param('id'), 10);

  if (isNaN(fileId)) {
    return c.json({ success: false, error: '無効なファイルIDです' }, 400);
  }

  try {
    const file = await getReceivedFileById(c.env.DB, fileId);

    if (!file) {
      return c.json({ success: false, error: 'ファイルが見つかりません' }, 404);
    }

    // リンクの所有者チェック
    const link = await getReceiveLinkById(c.env.DB, file.receive_link_id);
    if (!link || link.user_id !== userId) {
      return c.json({ success: false, error: 'アクセス権限がありません' }, 403);
    }

    // R2からファイルを削除
    await deleteFile(c.env.R2_BUCKET, file.r2_key);

    // DBから削除
    await deleteReceivedFile(c.env.DB, fileId);

    return c.json({ success: true });
  } catch (error) {
    console.error('ファイル削除エラー:', error);
    return c.json(
      { success: false, error: 'ファイルの削除に失敗しました' },
      500
    );
  }
});

/**
 * DELETE /api/receive-links/:id/full
 * 受信リンクとすべてのファイルを完全に削除
 */
receive.delete('/receive-links/:id/full', async (c) => {
  const userId = c.get('userId');
  const linkId = parseInt(c.req.param('id'), 10);

  if (isNaN(linkId)) {
    return c.json({ success: false, error: '無効なリンクIDです' }, 400);
  }

  try {
    // DBから削除（R2キーのリストを取得）
    const { deleted, r2Keys } = await deleteReceiveLinkWithFiles(
      c.env.DB,
      linkId,
      userId
    );

    if (!deleted) {
      return c.json(
        { success: false, error: 'リンクが見つからないか、アクセス権限がありません' },
        404
      );
    }

    // R2からファイルを削除
    for (const r2Key of r2Keys) {
      await deleteFile(c.env.R2_BUCKET, r2Key);
    }

    return c.json({ success: true, deletedFiles: r2Keys.length });
  } catch (error) {
    console.error('受信リンク削除エラー:', error);
    return c.json(
      { success: false, error: '受信リンクの削除に失敗しました' },
      500
    );
  }
});

export default receive;
