/**
 * 型定義ファイル
 * アプリケーション全体で使用する型を定義
 */

// =====================================================
// 環境変数・バインディング
// =====================================================

/**
 * Cloudflare Workers環境バインディング
 */
export interface Env {
  /** R2バケットバインディング */
  R2_BUCKET: R2Bucket;
  /** D1データベースバインディング */
  DB: D1Database;
  /** Resend APIキー */
  RESEND_API_KEY?: string;
  /** 認証スキップフラグ（開発環境用） */
  SKIP_AUTH?: string;
  /** Cloudflare Accessチーム名 */
  ACCESS_TEAM_NAME?: string;
  /** Cloudflare AccessアプリケーションAUD */
  ACCESS_AUD?: string;
}

// =====================================================
// データベースモデル
// =====================================================

/**
 * ユーザー
 */
export interface User {
  id: number;
  email: string;
  name: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * ファイル
 */
export interface FileRecord {
  id: number;
  user_id: number;
  r2_key: string;
  original_name: string;
  size: number;
  mime_type: string;
  created_at: string;
  deleted_at: string | null;
}

/**
 * ダウンロードリンク
 */
export interface DownloadLink {
  id: number;
  file_id: number;
  token: string;
  expires_at: string;
  password_hash: string | null;
  max_downloads: number | null;
  download_count: number;
  created_at: string;
  created_by: number;
  disabled_at: string | null;
}

/**
 * リンク送信先
 */
export interface LinkRecipient {
  id: number;
  link_id: number;
  email: string;
  sent_at: string;
}

/**
 * ダウンロード履歴
 */
export interface DownloadLog {
  id: number;
  link_id: number;
  ip_address: string | null;
  user_agent: string | null;
  downloaded_at: string;
}

/**
 * 受信リンク
 */
export interface ReceiveLink {
  id: number;
  user_id: number;
  token: string;
  title: string | null;
  expires_at: string;
  max_files: number | null;
  max_file_size: number | null;
  password_hash: string | null;
  created_at: string;
  disabled_at: string | null;
}

/**
 * 受信ファイル
 */
export interface ReceivedFile {
  id: number;
  receive_link_id: number;
  r2_key: string;
  original_name: string;
  size: number;
  mime_type: string;
  sender_name: string | null;
  sender_email: string | null;
  message: string | null;
  ip_address: string | null;
  uploaded_at: string;
  downloaded_at: string | null;
}

// =====================================================
// API リクエスト/レスポンス
// =====================================================

/**
 * ファイルアップロードレスポンス
 */
export interface UploadResponse {
  success: boolean;
  file?: FileRecord;
  error?: string;
}

/**
 * リンク作成リクエスト
 */
export interface CreateLinkRequest {
  /** 有効期限（日数: 1-10） */
  expires_days: number;
  /** パスワード（オプション） */
  password?: string;
  /** 最大ダウンロード回数（オプション） */
  max_downloads?: number;
}

/**
 * リンク作成レスポンス
 */
export interface CreateLinkResponse {
  success: boolean;
  link?: DownloadLink & { url: string };
  error?: string;
}

/**
 * メール送信リクエスト
 */
export interface SendEmailRequest {
  /** 送信先メールアドレスのリスト */
  recipients: string[];
  /** カスタムメッセージ（オプション） */
  message?: string;
}

/**
 * ダウンロード統計
 */
export interface DownloadStats {
  link_id: number;
  total_downloads: number;
  unique_ips: number;
  recent_logs: DownloadLog[];
  recipients: LinkRecipient[];
}

// =====================================================
// Hono コンテキスト拡張
// =====================================================

/**
 * 認証済みユーザー情報
 */
export interface AuthUser {
  email: string;
  name?: string;
}

/**
 * 言語設定
 */
export type Language = 'ja' | 'en';

/**
 * Honoコンテキスト用変数
 */
export interface Variables {
  user: AuthUser;
  userId: number;
  lang: Language;
}
