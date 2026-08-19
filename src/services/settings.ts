/**
 * アプリケーション設定サービス
 *
 * D1のapp_settingsテーブルに保存する設定値を扱う。
 * 環境変数で設定できない項目（初期セットアップ画面で入力された
 * 認証方式やSAML設定）はここに保存し、実行時に読み出す。
 */

/** 設定キー */
export const SETTING_KEYS = {
  sessionSecret: 'session_secret',
  authMethod: 'auth_method',
  samlEntityId: 'saml_entity_id',
  samlIdpSsoUrl: 'saml_idp_sso_url',
  samlIdpEntityId: 'saml_idp_entity_id',
  samlIdpCert: 'saml_idp_cert',
  samlCallbackUrl: 'saml_callback_url',
  allowedDomains: 'allowed_domains',
} as const;

/** D1に保存された認証設定 */
export interface StoredAuthConfig {
  authMethod?: string;
  samlEntityId?: string;
  samlIdpSsoUrl?: string;
  samlIdpEntityId?: string;
  samlIdpCert?: string;
  samlCallbackUrl?: string;
  allowedDomains?: string;
}

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
 * app_settingsに値を保存（既存の場合は上書き）
 */
export async function setSetting(
  db: D1Database,
  key: string,
  value: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    )
    .bind(key, value)
    .run();
}

/**
 * 認証関連の設定をまとめて取得
 */
export async function getStoredAuthConfig(
  db: D1Database
): Promise<StoredAuthConfig> {
  const result = await db
    .prepare('SELECT key, value FROM app_settings WHERE key != ?')
    .bind(SETTING_KEYS.sessionSecret)
    .all<{ key: string; value: string }>();

  const map = new Map(result.results.map((row) => [row.key, row.value]));

  return {
    authMethod: map.get(SETTING_KEYS.authMethod),
    samlEntityId: map.get(SETTING_KEYS.samlEntityId),
    samlIdpSsoUrl: map.get(SETTING_KEYS.samlIdpSsoUrl),
    samlIdpEntityId: map.get(SETTING_KEYS.samlIdpEntityId),
    samlIdpCert: map.get(SETTING_KEYS.samlIdpCert),
    samlCallbackUrl: map.get(SETTING_KEYS.samlCallbackUrl),
    allowedDomains: map.get(SETTING_KEYS.allowedDomains),
  };
}

/**
 * 認証方式を保存
 */
export async function setAuthMethod(
  db: D1Database,
  method: 'local' | 'saml'
): Promise<void> {
  await setSetting(db, SETTING_KEYS.authMethod, method);
}

/**
 * SAML設定を保存して認証方式をsamlに切り替える
 */
export async function saveSamlConfig(
  db: D1Database,
  config: {
    entityId: string;
    idpSsoUrl: string;
    idpEntityId: string;
    idpCert: string;
    callbackUrl: string;
    allowedDomains?: string;
  }
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      )
      .bind(SETTING_KEYS.samlEntityId, config.entityId),
    db
      .prepare(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      )
      .bind(SETTING_KEYS.samlIdpSsoUrl, config.idpSsoUrl),
    db
      .prepare(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      )
      .bind(SETTING_KEYS.samlIdpEntityId, config.idpEntityId),
    db
      .prepare(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      )
      .bind(SETTING_KEYS.samlIdpCert, config.idpCert),
    db
      .prepare(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      )
      .bind(SETTING_KEYS.samlCallbackUrl, config.callbackUrl),
    db
      .prepare(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      )
      .bind(SETTING_KEYS.allowedDomains, config.allowedDomains || ''),
    db
      .prepare(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      )
      .bind(SETTING_KEYS.authMethod, 'saml'),
  ]);
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

  const existing = await getSetting(db, SETTING_KEYS.sessionSecret);
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
    .bind(SETTING_KEYS.sessionSecret, secret)
    .run();

  const stored = await getSetting(db, SETTING_KEYS.sessionSecret);
  return stored ?? secret;
}
