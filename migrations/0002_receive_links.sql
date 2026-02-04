-- =====================================================
-- 受信リンク機能追加
-- 外部ユーザーがファイルをアップロードできるURL発行
-- =====================================================

-- 受信リンクテーブル
-- ゲストユーザーがファイルをアップロードできるリンク
CREATE TABLE IF NOT EXISTS receive_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,              -- リンクを作成したユーザー
    token TEXT NOT NULL UNIQUE,            -- 64文字の推測困難なトークン
    title TEXT,                            -- リンクのタイトル（説明用）
    expires_at TEXT NOT NULL,              -- 有効期限
    max_files INTEGER,                     -- 最大ファイル数（NULLは無制限）
    max_file_size INTEGER,                 -- 最大ファイルサイズ（バイト、NULLはデフォルト）
    password_hash TEXT,                    -- オプショナルのパスワード
    created_at TEXT DEFAULT (datetime('now')),
    disabled_at TEXT,                      -- 手動無効化日時
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- インデックス: トークンで高速アクセス
CREATE INDEX IF NOT EXISTS idx_receive_links_token ON receive_links(token);
-- インデックス: ユーザーIDでリンク一覧を取得
CREATE INDEX IF NOT EXISTS idx_receive_links_user_id ON receive_links(user_id);

-- 受信ファイルテーブル
-- 受信リンク経由でアップロードされたファイル
CREATE TABLE IF NOT EXISTS received_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receive_link_id INTEGER NOT NULL,
    r2_key TEXT NOT NULL UNIQUE,           -- R2内のオブジェクトキー
    original_name TEXT NOT NULL,           -- 元のファイル名
    size INTEGER NOT NULL,                 -- ファイルサイズ（バイト）
    mime_type TEXT NOT NULL,               -- MIMEタイプ
    sender_name TEXT,                      -- 送信者名（オプション）
    sender_email TEXT,                     -- 送信者メール（オプション）
    message TEXT,                          -- メッセージ（オプション）
    ip_address TEXT,                       -- アップロード元IPアドレス
    uploaded_at TEXT DEFAULT (datetime('now')),
    downloaded_at TEXT,                    -- ダウンロード済み日時
    FOREIGN KEY (receive_link_id) REFERENCES receive_links(id)
);

-- インデックス: 受信リンクIDでファイル一覧を取得
CREATE INDEX IF NOT EXISTS idx_received_files_receive_link_id ON received_files(receive_link_id);
