/**
 * アプリケーション設定サービス
 * D1のapp_settingsテーブルに保存する設定値を扱う
 */

/** セッション署名キーを保存するキー名 */
const SESSION_SECRET_KEY = 'session_secret';

/**
 * app_settingsから値を取得
 */
export async function getSetting(
  db: D1Database,
  key: string
): Promise<string | null> {
  const row = await db
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .bind(key)
    .first<{ value: string }>();

  return row?.value ?? null;
}

/**
 * セッション署名キーを取得（なければ生成して保存）
 *
 * 環境変数 SESSION_SECRET が設定されている場合はそちらを優先する。
 * 未設定の場合は初回アクセス時にランダムな値を生成してD1に保存し、
 * 以降はその値を使い続ける。
 * これによりシークレット未設定のままデプロイしても
 * 管理者登録・ログインが機能する。
 */
export async function getSessionSecret(
  db: D1Database,
  envSecret?: string
): Promise<string> {
  if (envSecret) {
    return envSecret;
  }

  const existing = await getSetting(db, SESSION_SECRET_KEY);
  if (existing) {
    return existing;
  }

  // 32バイトのランダム値をhex文字列として生成
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const secret = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // 同時アクセスで二重生成されないよう INSERT OR IGNORE を使い、
  // 挿入後に必ず保存済みの値を読み直す
  await db
    .prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)')
    .bind(SESSION_SECRET_KEY, secret)
    .run();

  const stored = await getSetting(db, SESSION_SECRET_KEY);
  return stored ?? secret;
}
