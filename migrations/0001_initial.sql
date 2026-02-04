-- =====================================================
-- 法人向けファイルアップローダー 初期スキーマ
-- =====================================================

-- ユーザーテーブル
-- Cloudflare Accessで認証されたユーザー情報を保存
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- インデックス: メールアドレスで高速検索
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ファイルテーブル
-- R2にアップロードされたファイルのメタデータを管理
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    r2_key TEXT NOT NULL UNIQUE,           -- R2内のオブジェクトキー
    original_name TEXT NOT NULL,           -- 元のファイル名
    size INTEGER NOT NULL,                 -- ファイルサイズ（バイト）
    mime_type TEXT NOT NULL,               -- MIMEタイプ
    created_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT,                       -- 論理削除日時
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- インデックス: ユーザーIDでファイル一覧を取得
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
-- インデックス: 削除されていないファイルを効率的に取得
CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON files(deleted_at);

-- ダウンロードリンクテーブル
-- ファイルへのアクセス用トークンと有効期限を管理
CREATE TABLE IF NOT EXISTS download_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,            -- 64文字の推測困難なトークン
    expires_at TEXT NOT NULL,              -- 有効期限（1-10日）
    password_hash TEXT,                    -- オプショナルのパスワード（ハッシュ化）
    max_downloads INTEGER,                 -- 最大ダウンロード回数（NULLは無制限）
    download_count INTEGER DEFAULT 0,      -- 現在のダウンロード回数
    created_at TEXT DEFAULT (datetime('now')),
    created_by INTEGER NOT NULL,           -- リンクを作成したユーザー
    disabled_at TEXT,                      -- 手動無効化日時
    FOREIGN KEY (file_id) REFERENCES files(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- インデックス: トークンで高速アクセス（ダウンロード時に使用）
CREATE INDEX IF NOT EXISTS idx_download_links_token ON download_links(token);
-- インデックス: ファイルIDでリンク一覧を取得
CREATE INDEX IF NOT EXISTS idx_download_links_file_id ON download_links(file_id);
-- インデックス: 有効期限切れリンクのクリーンアップ用
CREATE INDEX IF NOT EXISTS idx_download_links_expires_at ON download_links(expires_at);

-- リンク送信先テーブル
-- ダウンロードリンクを送信したメールアドレスを記録
CREATE TABLE IF NOT EXISTS link_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id INTEGER NOT NULL,
    email TEXT NOT NULL,                   -- 送信先メールアドレス
    sent_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (link_id) REFERENCES download_links(id)
);

-- インデックス: リンクIDで送信先一覧を取得
CREATE INDEX IF NOT EXISTS idx_link_recipients_link_id ON link_recipients(link_id);

-- ダウンロード履歴テーブル
-- いつ、誰が、どこからダウンロードしたかを記録
CREATE TABLE IF NOT EXISTS download_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id INTEGER NOT NULL,
    ip_address TEXT,                       -- ダウンロード元IPアドレス
    user_agent TEXT,                       -- ユーザーエージェント
    downloaded_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (link_id) REFERENCES download_links(id)
);

-- インデックス: リンクIDでダウンロード履歴を取得
CREATE INDEX IF NOT EXISTS idx_download_logs_link_id ON download_logs(link_id);
-- インデックス: 日時でソート・フィルター
CREATE INDEX IF NOT EXISTS idx_download_logs_downloaded_at ON download_logs(downloaded_at);
