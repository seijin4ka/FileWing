-- レート制限テーブル
-- パスワード検証の失敗回数を追跡

CREATE TABLE IF NOT EXISTS password_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,       -- IPアドレス:トークンの組み合わせ
  attempt_type TEXT NOT NULL,     -- 'download' or 'receive'
  failed_at TEXT NOT NULL,        -- ISO8601形式のタイムスタンプ
  created_at TEXT DEFAULT (datetime('now'))
);

-- インデックス: 識別子とタイムスタンプで検索
CREATE INDEX IF NOT EXISTS idx_password_attempts_identifier
ON password_attempts(identifier, failed_at);

-- 古いレコードを定期的に削除するためのインデックス
CREATE INDEX IF NOT EXISTS idx_password_attempts_created
ON password_attempts(created_at);
