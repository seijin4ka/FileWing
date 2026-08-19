/**
 * セッション管理サービス
 * JWT生成・検証、Cookie操作を提供
 */

import type { SessionPayload } from '../types';

/** セッションCookie名 */
const SESSION_COOKIE_NAME = 'filewing_session';

/** デフォルトセッション有効期限（1日 = 86400秒） */
const DEFAULT_SESSION_MAX_AGE = 86400;

/**
 * セッションJWTを生成
 */
export async function createSessionToken(
  payload: Omit<SessionPayload, 'iat' | 'exp'>,
  secret: string,
  maxAge: number = DEFAULT_SESSION_MAX_AGE
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const sessionPayload: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + maxAge,
  };

  // JWTヘッダー
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(sessionPayload));

  // 署名を生成
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await signHmac(signatureInput, secret);

  return `${signatureInput}.${signature}`;
}

/**
 * セッションJWTを検証
 */
export async function verifySessionToken(
  token: string,
  secret: string
): Promise<SessionPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // 署名を検証
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = await signHmac(signatureInput, secret);

    if (!timingSafeEqual(signature, expectedSignature)) {
      return null;
    }

    // ペイロードをデコード
    const payloadJson = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(payloadJson) as SessionPayload;

    // 有効期限チェック
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * セッションCookieを生成
 */
export function createSessionCookie(
  token: string,
  maxAge: number = DEFAULT_SESSION_MAX_AGE,
  secure: boolean = true
): string {
  const flags = [
    `${SESSION_COOKIE_NAME}=${token}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    `SameSite=Lax`,
  ];

  if (secure) {
    flags.push('Secure');
  }

  return flags.join('; ');
}

/**
 * セッションCookieを削除（ログアウト用）
 */
export function createLogoutCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`;
}

/**
 * CookieヘッダーからセッションJWTを取得
 */
export function getSessionTokenFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=');
    if (name === SESSION_COOKIE_NAME && value) {
      return value;
    }
  }

  return null;
}

/**
 * セッション最大期間を取得（環境変数から）
 */
export function getSessionMaxAge(sessionMaxAgeEnv?: string): number {
  if (sessionMaxAgeEnv) {
    const parsed = parseInt(sessionMaxAgeEnv, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_SESSION_MAX_AGE;
}

// =====================================================
// 内部ヘルパー関数
// =====================================================

/**
 * HMAC-SHA256署名を生成
 */
async function signHmac(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const dataBytes = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, dataBytes);
  const signatureArray = new Uint8Array(signatureBuffer);

  return base64UrlEncodeBytes(signatureArray);
}

/**
 * Base64 URL エンコード（文字列）
 * btoaはLatin1範囲の文字しか扱えないため、
 * 日本語などの非ASCII文字を含む場合に備えて先にUTF-8バイト列へ変換する
 */
function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return base64UrlEncodeBytes(bytes);
}

/**
 * Base64 URL エンコード（バイト配列）
 */
function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64 URL デコード
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }

  // base64UrlEncodeがUTF-8バイト列を出力するため、デコード側もUTF-8として復元する
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * タイミング安全な文字列比較
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
