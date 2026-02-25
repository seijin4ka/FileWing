/**
 * メール送信サービス
 * Cloudflare Workers Email Sending（Email Routing統合）を使用
 */

import { createMimeMessage } from 'mimetext/browser';
import type { SendEmailBinding } from '../types';
import { escapeHtml } from '../templates/layout';

export interface EmailOptions {
  /** Email Sendingバインディング */
  emailBinding: SendEmailBinding;
  /** 送信先メールアドレス */
  to: string;
  /** 送信元メールアドレス */
  from: string;
  /** 送信者名 */
  fromName: string;
  /** 件名 */
  subject: string;
  /** 本文（HTML） */
  html: string;
  /** 本文（プレーンテキスト） */
  text?: string;
}

export interface SendResult {
  success: boolean;
  error?: string;
}

/**
 * Cloudflare Email Sendingでメールを送信
 */
export async function sendEmail(options: EmailOptions): Promise<SendResult> {
  try {
    // MIMEメッセージを作成
    const msg = createMimeMessage();
    msg.setSender({ name: options.fromName, addr: options.from });
    msg.setRecipient(options.to);
    msg.setSubject(options.subject);

    // HTML本文を追加
    msg.addMessage({
      contentType: 'text/html',
      data: options.html,
    });

    // プレーンテキスト本文を追加（オプション）
    if (options.text) {
      msg.addMessage({
        contentType: 'text/plain',
        data: options.text,
      });
    }

    // EmailMessageを作成して送信
    // cloudflare:emailからのインポートは実行時に解決される
    const { EmailMessage } = await import('cloudflare:email');
    const emailMessage = new EmailMessage(options.from, options.to, msg.asRaw());

    await options.emailBinding.send(emailMessage);

    return { success: true };
  } catch (error) {
    console.error('メール送信エラー:', error);
    return {
      success: false,
      error: `メール送信エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
    };
  }
}

/**
 * 複数の宛先にメールを送信
 */
export async function sendEmailToMultiple(
  emailBinding: SendEmailBinding,
  recipients: string[],
  from: string,
  fromName: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const to of recipients) {
    const result = await sendEmail({
      emailBinding,
      to,
      from,
      fromName,
      subject,
      html,
      text,
    });

    if (!result.success) {
      errors.push(`${to}: ${result.error}`);
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * ダウンロードリンク通知メールのHTMLを生成
 */
export function generateDownloadNotificationHtml(params: {
  senderName: string;
  fileName: string;
  fileSize: string;
  downloadUrl: string;
  expiresAt: string;
  customMessage?: string;
}): string {
  const { senderName, fileName, fileSize, downloadUrl, expiresAt, customMessage } =
    params;

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f6821f 0%, #ea580c 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">ファイルが届いています</h1>
  </div>

  <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
    <p style="margin-top: 0;">${senderName} さんからファイルが届きました。</p>

    ${customMessage ? `<div style="background: white; padding: 15px; border-left: 4px solid #f6821f; margin: 20px 0;"><p style="margin: 0; font-style: italic;">${escapeHtml(customMessage)}</p></div>` : ''}

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6c757d; width: 100px;">ファイル名</td>
          <td style="padding: 8px 0; font-weight: bold;">${escapeHtml(fileName)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6c757d;">サイズ</td>
          <td style="padding: 8px 0;">${fileSize}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6c757d;">有効期限</td>
          <td style="padding: 8px 0;">${expiresAt}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${downloadUrl}" style="display: inline-block; background: linear-gradient(135deg, #f6821f 0%, #ea580c 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">ダウンロードする</a>
    </div>

    <p style="font-size: 12px; color: #6c757d; margin-bottom: 0;">
      このリンクは ${expiresAt} まで有効です。<br>
      心当たりのない場合は、このメールを無視してください。
    </p>
  </div>

  <div style="padding: 20px; text-align: center; font-size: 12px; color: #6c757d;">
    <p style="margin: 0;">このメールは自動送信されています。</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * プレーンテキスト版のメール本文を生成
 */
export function generateDownloadNotificationText(params: {
  senderName: string;
  fileName: string;
  fileSize: string;
  downloadUrl: string;
  expiresAt: string;
  customMessage?: string;
}): string {
  const { senderName, fileName, fileSize, downloadUrl, expiresAt, customMessage } =
    params;

  let text = `${senderName} さんからファイルが届きました。

`;

  if (customMessage) {
    text += `メッセージ:
${customMessage}

`;
  }

  text += `ファイル情報:
- ファイル名: ${fileName}
- サイズ: ${fileSize}
- 有効期限: ${expiresAt}

ダウンロードURL:
${downloadUrl}

このリンクは ${expiresAt} まで有効です。
心当たりのない場合は、このメールを無視してください。
`;

  return text;
}

/**
 * 日時を日本語形式でフォーマット
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });
}
