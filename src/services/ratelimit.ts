/**
 * レート制限サービス
 * パスワード検証のブルートフォース攻撃を防止
 */

// レート制限の設定
const MAX_ATTEMPTS = 5; // 最大試行回数
const WINDOW_MINUTES = 15; // 制限ウィンドウ（分）
const LOCKOUT_MINUTES = 30; // ロックアウト時間（分）

interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
}

/**
 * パスワード検証の試行が許可されているかチェック
 */
export async function checkRateLimit(
  db: D1Database,
  ipAddress: string | undefined,
  token: string,
  attemptType: 'download' | 'receive'
): Promise<RateLimitResult> {
  const identifier = `${ipAddress || 'unknown'}:${token}`;
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  // ウィンドウ内の失敗回数を取得
  const result = await db
    .prepare(
      `SELECT COUNT(*) as count, MAX(failed_at) as last_attempt
       FROM password_attempts
       WHERE identifier = ? AND attempt_type = ? AND failed_at > ?`
    )
    .bind(identifier, attemptType, windowStart)
    .first<{ count: number; last_attempt: string | null }>();

  const failedAttempts = result?.count || 0;

  if (failedAttempts >= MAX_ATTEMPTS) {
    // ロックアウト中かチェック
    const lockoutEnd = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
    const lockoutCheck = await db
      .prepare(
        `SELECT COUNT(*) as count FROM password_attempts
         WHERE identifier = ? AND attempt_type = ? AND failed_at > ?`
      )
      .bind(identifier, attemptType, lockoutEnd)
      .first<{ count: number }>();

    if ((lockoutCheck?.count || 0) >= MAX_ATTEMPTS) {
      // まだロックアウト中
      const lastAttempt = result?.last_attempt
        ? new Date(result.last_attempt)
        : new Date();
      const unlockTime = new Date(lastAttempt.getTime() + LOCKOUT_MINUTES * 60 * 1000);
      const retryAfterSeconds = Math.ceil((unlockTime.getTime() - Date.now()) / 1000);

      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds: Math.max(0, retryAfterSeconds),
      };
    }
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - failedAttempts),
  };
}

/**
 * 失敗した試行を記録
 */
export async function recordFailedAttempt(
  db: D1Database,
  ipAddress: string | undefined,
  token: string,
  attemptType: 'download' | 'receive'
): Promise<void> {
  const identifier = `${ipAddress || 'unknown'}:${token}`;
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO password_attempts (identifier, attempt_type, failed_at)
       VALUES (?, ?, ?)`
    )
    .bind(identifier, attemptType, now)
    .run();
}

/**
 * 成功した場合、そのトークンの失敗記録をクリア
 */
export async function clearFailedAttempts(
  db: D1Database,
  ipAddress: string | undefined,
  token: string,
  attemptType: 'download' | 'receive'
): Promise<void> {
  const identifier = `${ipAddress || 'unknown'}:${token}`;

  await db
    .prepare(
      `DELETE FROM password_attempts
       WHERE identifier = ? AND attempt_type = ?`
    )
    .bind(identifier, attemptType)
    .run();
}

/**
 * 古い失敗記録を削除（定期クリーンアップ用）
 */
export async function cleanupOldAttempts(db: D1Database): Promise<number> {
  // 24時間以上前のレコードを削除
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const result = await db
    .prepare(`DELETE FROM password_attempts WHERE created_at < ?`)
    .bind(cutoff)
    .run();

  return result.meta.changes || 0;
}
