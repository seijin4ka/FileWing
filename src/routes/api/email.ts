/**
 * メール送信API
 * Cloudflare Workers Email Sendingでダウンロードリンクを送信
 */

import { Hono } from 'hono';
import type { Env, Variables, SendEmailRequest } from '../../types';
import { getLinkById, getFileById, addLinkRecipients } from '../../services/d1';
import {
  sendEmailToMultiple,
  generateDownloadNotificationHtml,
  generateDownloadNotificationText,
  formatFileSize,
  formatDateTime,
} from '../../services/email';

const email = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * POST /api/links/:id/send
 * ダウンロードリンクをメールで送信
 */
email.post('/links/:id/send', async (c) => {
  const userId = c.get('userId');
  const user = c.get('user');
  const linkId = parseInt(c.req.param('id'), 10);

  if (isNaN(linkId)) {
    return c.json({ success: false, error: '無効なリンクIDです' }, 400);
  }

  // Email Sendingバインディングの確認
  if (!c.env.EMAIL) {
    return c.json(
      { success: false, error: 'メール送信が設定されていません。Cloudflare Email Routingを有効化してください。' },
      503
    );
  }

  try {
    // リンクの存在確認
    const link = await getLinkById(c.env.DB, linkId);

    if (!link) {
      return c.json({ success: false, error: 'リンクが見つかりません' }, 404);
    }

    // リンクの有効性チェック
    if (link.disabled_at) {
      return c.json({ success: false, error: 'このリンクは無効化されています' }, 400);
    }

    if (new Date(link.expires_at) < new Date()) {
      return c.json({ success: false, error: 'このリンクは期限切れです' }, 400);
    }

    // ファイルの所有者チェック
    const file = await getFileById(c.env.DB, link.file_id);
    if (!file || file.user_id !== userId) {
      return c.json({ success: false, error: 'アクセス権限がありません' }, 403);
    }

    // リクエストボディを取得
    const body = await c.req.json<SendEmailRequest>();

    if (!body.recipients || body.recipients.length === 0) {
      return c.json({ success: false, error: '送信先を指定してください' }, 400);
    }

    // メールアドレスの検証
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = body.recipients.filter((e) => !emailRegex.test(e));
    if (invalidEmails.length > 0) {
      return c.json(
        { success: false, error: `無効なメールアドレス: ${invalidEmails.join(', ')}` },
        400
      );
    }

    // 送信数制限（1回に最大10件）
    if (body.recipients.length > 10) {
      return c.json(
        { success: false, error: '一度に送信できるのは10件までです' },
        400
      );
    }

    // ダウンロードURLを生成
    const url = new URL(c.req.url);
    const downloadUrl = `${url.origin}/d/${link.token}`;

    // 送信元メールアドレス（環境変数から取得、未設定時はエラー）
    const fromEmail = c.env.EMAIL_FROM;
    if (!fromEmail) {
      return c.json(
        { success: false, error: '送信元メールアドレスが設定されていません。EMAIL_FROM環境変数を設定してください。' },
        503
      );
    }

    // メール本文を生成
    const senderName = user.name || user.email;
    const html = generateDownloadNotificationHtml({
      senderName,
      fileName: file.original_name,
      fileSize: formatFileSize(file.size),
      downloadUrl,
      expiresAt: formatDateTime(link.expires_at),
      customMessage: body.message,
    });

    const text = generateDownloadNotificationText({
      senderName,
      fileName: file.original_name,
      fileSize: formatFileSize(file.size),
      downloadUrl,
      expiresAt: formatDateTime(link.expires_at),
      customMessage: body.message,
    });

    // メール送信
    const result = await sendEmailToMultiple(
      c.env.EMAIL,
      body.recipients,
      fromEmail,
      'FileWing',
      `${senderName} さんからファイルが届いています: ${file.original_name}`,
      html,
      text
    );

    if (!result.success) {
      console.error('メール送信エラー:', result.errors);
      return c.json(
        { success: false, error: `一部のメール送信に失敗しました: ${result.errors.join(', ')}` },
        500
      );
    }

    // 送信先を記録
    await addLinkRecipients(c.env.DB, linkId, body.recipients);

    return c.json({
      success: true,
      sentTo: body.recipients,
    });
  } catch (error) {
    console.error('メール送信エラー:', error);
    return c.json(
      { success: false, error: 'メール送信に失敗しました' },
      500
    );
  }
});

export default email;
