-- ローカル認証（管理者登録方式）対応
-- SAML/Cloudflare Accessを使わない場合に、公開URLへ最初にアクセスした
-- 管理者がその場でアカウントを登録できるようにする

-- ユーザーテーブルにパスワードハッシュとロールを追加
-- password_hash は PBKDF2形式（iterations:salt:hash）
-- SAML認証で作成されたユーザーは password_hash が NULL になる
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

-- ロールで管理者の存在を高速に判定するためのインデックス
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- アプリケーション設定テーブル
-- SESSION_SECRET が環境変数に設定されていない場合、
-- 初回アクセス時に生成した署名キーをここに保存する
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
