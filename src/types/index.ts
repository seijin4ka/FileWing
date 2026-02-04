/**
 * 型定義ファイル
 * アプリケーション全体で使用する型を定義
 */

// =====================================================
// 環境変数・バインディング
// =====================================================

/**
 * Cloudflare Email Sendingバインディング型
 * EmailMessageはcloudflare:emailモジュールから動的にインポートされるため、
 * ここではanyを使用してバインディングの型を定義
 */
export interface SendEmailBinding {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  send(email: any): Promise<void>;
}

/**
 * Cloudflare Workers環境バインディング
 */
export interface Env {
  /** R2バケットバインディング */
  R2_BUCKET: R2Bucket;
  /** D1データベースバインディング */
  DB: D1Database;
  /** Email Sendingバインディング */
  EMAIL?: SendEmailBinding;
  /** 送信元メールアドレス */
  EMAIL_FROM?: string;
  /** 認証スキップフラグ（開発環境用） */
  SKIP_AUTH?: string;
  /** Cloudflare Accessチーム名（後方互換用、非推奨） */
  ACCESS_TEAM_NAME?: string;
  /** Cloudflare AccessアプリケーションAUD（後方互換用、非推奨） */
  ACCESS_AUD?: string;

  // SAML認証設定
  /** SP Entity ID（通常はアプリケーションのURL） */
  SAML_ENTITY_ID?: string;
  /** IdP SSO URL（Google SAML SSO URL） */
  SAML_IDP_SSO_URL?: string;
  /** IdP Entity ID */
  SAML_IDP_ENTITY_ID?: string;
  /** ACS URL（SAMLResponse受信エンドポイント） */
  SAML_CALLBACK_URL?: string;
  /** IdP X.509証明書（Base64エンコード） */
  SAML_IDP_CERT?: string;

  // セッション設定
  /** セッション署名用シークレットキー */
  SESSION_SECRET?: string;
  /** セッション有効期限（秒、デフォルト: 86400 = 1日） */
  SESSION_MAX_AGE?: string;
  /** アプリケーションURL（リダイレクト先） */
  APP_URL?: string;
  /** 許可されたドメイン（カンマ区切り） */
  ALLOWED_DOMAINS?: string;

  // 認証方式選択
  /** 認証方式: 'saml' | 'cloudflare-access' | 'skip' */
  AUTH_METHOD?: string;
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
  /** 認証プロバイダー */
  provider?: 'cloudflare-access' | 'google-saml' | 'test';
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

// =====================================================
// SAML認証関連
// =====================================================

/**
 * SAMLセッションペイロード（JWTに格納）
 */
export interface SessionPayload {
  /** ユーザーメールアドレス */
  sub: string;
  /** 表示名 */
  name?: string;
  /** 認証プロバイダー */
  provider: 'google-saml' | 'test';
  /** 発行時刻（Unix timestamp） */
  iat: number;
  /** 有効期限（Unix timestamp） */
  exp: number;
}
