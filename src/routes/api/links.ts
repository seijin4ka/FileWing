/**
 * リンク管理API
 * ダウンロードリンクの作成、削除、統計取得
 */

import { Hono } from 'hono';
import type { Env, Variables, CreateLinkRequest } from '../../types';
import {
  createDownloadLink,
  getFileById,
  getLinkById,
  disableLink,
  getDownloadStats,
  getValidLinkByToken,
  incrementDownloadCount,
  logDownload,
  shouldDeleteFile,
  markFileDeleted,
} from '../../services/d1';
import { getFile, deleteFile } from '../../services/r2';
import { hashPassword, verifyPassword } from '../../utils/crypto';

const links = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * POST /api/files/:fileId/links
 * ファイルのダウンロードリンクを作成
 */
links.post('/files/:fileId/links', async (c) => {
  const userId = c.get('userId');
  const fileId = parseInt(c.req.param('fileId'), 10);

  if (isNaN(fileId)) {
    return c.json({ success: false, error: '無効なファイルIDです' }, 400);
  }

  try {
    // ファイルの存在確認と所有者チェック
    const file = await getFileById(c.env.DB, fileId);

    if (!file) {
      return c.json({ success: false, error: 'ファイルが見つかりません' }, 404);
    }

    if (file.user_id !== userId) {
      return c.json({ success: false, error: 'アクセス権限がありません' }, 403);
    }

    // リクエストボディを取得
    const body = await c.req.json<CreateLinkRequest>();
    const expiresDays = body.expires_days || 7;

    // パスワードハッシュ（設定されている場合）
    // PBKDF2 + ソルトで強力なハッシュを生成
    let passwordHash: string | undefined;
    if (body.password) {
      passwordHash = await hashPassword(body.password);
    }

    // ダウンロードリンクを作成
    const link = await createDownloadLink(
      c.env.DB,
      fileId,
      userId,
      expiresDays,
      passwordHash,
      body.max_downloads
    );

    // ダウンロードURLを生成
    const url = new URL(c.req.url);
    const downloadUrl = `${url.origin}/d/${link.token}`;

    return c.json({
      success: true,
      link: {
        ...link,
        url: downloadUrl,
      },
    });
  } catch (error) {
    console.error('リンク作成エラー:', error);
    return c.json(
      { success: false, error: 'リンクの作成に失敗しました' },
      500
    );
  }
});

/**
 * DELETE /api/links/:id
 * ダウンロードリンクを無効化
 */
links.delete('/links/:id', async (c) => {
  const userId = c.get('userId');
  const linkId = parseInt(c.req.param('id'), 10);

  if (isNaN(linkId)) {
    return c.json({ success: false, error: '無効なリンクIDです' }, 400);
  }

  try {
    const disabled = await disableLink(c.env.DB, linkId, userId);

    if (!disabled) {
      return c.json(
        { success: false, error: 'リンクが見つからないか、既に無効化されています' },
        404
      );
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('リンク無効化エラー:', error);
    return c.json(
      { success: false, error: 'リンクの無効化に失敗しました' },
      500
    );
  }
});

/**
 * GET /api/links/:id/stats
 * ダウンロード統計を取得
 */
links.get('/links/:id/stats', async (c) => {
  const userId = c.get('userId');
  const linkId = parseInt(c.req.param('id'), 10);

  if (isNaN(linkId)) {
    return c.json({ success: false, error: '無効なリンクIDです' }, 400);
  }

  try {
    // リンクの存在確認と所有者チェック
    const link = await getLinkById(c.env.DB, linkId);

    if (!link) {
      return c.json({ success: false, error: 'リンクが見つかりません' }, 404);
    }

    // ファイルの所有者チェック
    const file = await getFileById(c.env.DB, link.file_id);
    if (!file || file.user_id !== userId) {
      return c.json({ success: false, error: 'アクセス権限がありません' }, 403);
    }

    // 統計を取得
    const stats = await getDownloadStats(c.env.DB, linkId);

    return c.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('統計取得エラー:', error);
    return c.json(
      { success: false, error: '統計の取得に失敗しました' },
      500
    );
  }
});

/**
 * GET /d/:token/download
 * ファイルをダウンロード（公開エンドポイント）
 */
links.get('/d/:token/download', async (c) => {
  const token = c.req.param('token');

  try {
    // 有効なリンクを取得
    const linkWithFile = await getValidLinkByToken(c.env.DB, token);

    if (!linkWithFile) {
      return c.json(
        { success: false, error: 'リンクが無効か期限切れです' },
        404
      );
    }

    // パスワードチェック（設定されている場合）
    if (linkWithFile.password_hash) {
      const password = c.req.query('password') || c.req.header('X-Download-Password');
      if (!password) {
        return c.json(
          { success: false, error: 'パスワードが必要です', requirePassword: true },
          401
        );
      }

      // パスワード検証（PBKDF2、旧形式のSHA-256もサポート）
      const isValid = await verifyPassword(password, linkWithFile.password_hash);
      if (!isValid) {
        return c.json(
          { success: false, error: 'パスワードが正しくありません' },
          401
        );
      }
    }

    // R2からファイルを取得
    const r2Object = await getFile(c.env.R2_BUCKET, linkWithFile.file.r2_key);

    if (!r2Object) {
      return c.json(
        { success: false, error: 'ファイルが見つかりません' },
        404
      );
    }

    // ダウンロードカウントをインクリメント（上限到達時は自動無効化）
    await incrementDownloadCount(c.env.DB, linkWithFile.id);

    // ダウンロード履歴を記録
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
    const userAgent = c.req.header('User-Agent');
    await logDownload(c.env.DB, linkWithFile.id, ipAddress, userAgent);

    // ファイルに有効なリンクがなくなった場合はR2から削除
    const shouldDelete = await shouldDeleteFile(c.env.DB, linkWithFile.file_id);
    if (shouldDelete) {
      try {
        await deleteFile(c.env.R2_BUCKET, linkWithFile.file.r2_key);
        await markFileDeleted(c.env.DB, linkWithFile.file_id);
        console.log(`ファイル削除: ${linkWithFile.file.r2_key}`);
      } catch (deleteError) {
        console.error('ファイル削除エラー:', deleteError);
      }
    }

    // ファイル名をエンコード（RFC 5987）
    const encodedFilename = encodeURIComponent(linkWithFile.file.original_name)
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29');

    // レスポンスヘッダーを設定
    const headers = new Headers();
    headers.set('Content-Type', linkWithFile.file.mime_type);
    headers.set(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodedFilename}`
    );
    headers.set('Content-Length', linkWithFile.file.size.toString());

    return new Response(r2Object.body, { headers });
  } catch (error) {
    console.error('ダウンロードエラー:', error);
    return c.json(
      { success: false, error: 'ダウンロードに失敗しました' },
      500
    );
  }
});

export default links;
