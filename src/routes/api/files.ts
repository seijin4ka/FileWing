/**
 * ファイル管理API
 * アップロード、一覧取得、削除などのエンドポイント
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';
import {
  uploadFile,
  generateR2Key,
  deleteFile,
} from '../../services/r2';
import {
  createFile,
  getFileById,
  softDeleteFile,
  deleteLinksByFile,
  getFilesWithLinkStatsByUser,
  getLinksByFile,
} from '../../services/d1';
import { validateMimeType } from '../../utils/mime';

const files = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * POST /api/files
 * ファイルをアップロード
 */
files.post('/', async (c) => {
  const userId = c.get('userId');

  try {
    // multipart/form-dataからファイルを取得
    const formData = await c.req.formData();
    const formFile = formData.get('file');

    if (!formFile || typeof formFile === 'string') {
      return c.json({ success: false, error: 'ファイルが指定されていません' }, 400);
    }

    // File型にキャスト
    const file = formFile as File;

    // R2はファイルサイズ無制限のため、制限チェックは不要

    // ファイルデータを読み込み
    const arrayBuffer = await file.arrayBuffer();

    // MIMEタイプをマジックバイトで検証（クライアント提供値より優先）
    const { mime: mimeType } = validateMimeType(
      arrayBuffer,
      file.name,
      file.type || 'application/octet-stream'
    );

    // R2キーを生成
    const r2Key = generateR2Key(userId, file.name);

    // R2にアップロード
    await uploadFile(c.env.R2_BUCKET, r2Key, arrayBuffer, mimeType);

    // D1にメタデータを保存
    const fileRecord = await createFile(
      c.env.DB,
      userId,
      r2Key,
      file.name,
      file.size,
      mimeType
    );

    return c.json({
      success: true,
      file: fileRecord,
    });
  } catch (error) {
    console.error('ファイルアップロードエラー:', error);
    return c.json(
      {
        success: false,
        error: 'ファイルのアップロードに失敗しました',
      },
      500
    );
  }
});

/**
 * GET /api/files
 * ユーザーのファイル一覧を取得
 */
files.get('/', async (c) => {
  const userId = c.get('userId');

  try {
    // ファイル一覧をリンク統計と共に取得（N+1解消）
    const filesWithStats = await getFilesWithLinkStatsByUser(c.env.DB, userId);

    return c.json({
      success: true,
      files: filesWithStats,
    });
  } catch (error) {
    console.error('ファイル一覧取得エラー:', error);
    return c.json(
      { success: false, error: 'ファイル一覧の取得に失敗しました' },
      500
    );
  }
});

/**
 * GET /api/files/:id
 * ファイルの詳細を取得
 */
files.get('/:id', async (c) => {
  const userId = c.get('userId');
  const fileId = parseInt(c.req.param('id'), 10);

  if (isNaN(fileId)) {
    return c.json({ success: false, error: '無効なファイルIDです' }, 400);
  }

  try {
    const file = await getFileById(c.env.DB, fileId);

    if (!file) {
      return c.json({ success: false, error: 'ファイルが見つかりません' }, 404);
    }

    // 所有者チェック
    if (file.user_id !== userId) {
      return c.json({ success: false, error: 'アクセス権限がありません' }, 403);
    }

    // リンク一覧を取得
    const links = await getLinksByFile(c.env.DB, file.id);

    return c.json({
      success: true,
      file,
      links,
    });
  } catch (error) {
    console.error('ファイル詳細取得エラー:', error);
    return c.json(
      { success: false, error: 'ファイル詳細の取得に失敗しました' },
      500
    );
  }
});

/**
 * DELETE /api/files/:id
 * ファイルを削除（論理削除）
 */
files.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const fileId = parseInt(c.req.param('id'), 10);

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

    // ファイルに紐づく全リンクを完全削除
    await deleteLinksByFile(c.env.DB, fileId);

    // 論理削除
    const deleted = await softDeleteFile(c.env.DB, fileId, userId);

    if (!deleted) {
      return c.json({ success: false, error: 'ファイルの削除に失敗しました' }, 500);
    }

    // R2からも削除
    await deleteFile(c.env.R2_BUCKET, file.r2_key);

    return c.json({ success: true });
  } catch (error) {
    console.error('ファイル削除エラー:', error);
    return c.json(
      { success: false, error: 'ファイルの削除に失敗しました' },
      500
    );
  }
});

export default files;
