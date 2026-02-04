/**
 * Cloudflare Access認証ミドルウェア
 * JWTトークンを検証し、ユーザー情報をコンテキストに設定
 */

import { Context, Next } from 'hono';
import type { Env, Variables } from '../types';
import { findOrCreateUser } from '../services/d1';

/**
 * Cloudflare AccessのJWTペイロード
 */
interface AccessJwtPayload {
  aud: string[];
  email: string;
  exp: number;
  iat: number;
  iss: string;
  sub: string;
  name?: string;
  custom?: Record<string, unknown>;
}

/**
 * JWKSレスポンスの型定義
 */
interface JwksResponse {
  keys: Array<{
    kid: string;
    kty: string;
    alg: string;
    use: string;
    e: string;
    n: string;
  }>;
  public_cert: {
    kid: string;
    cert: string;
  };
  public_certs: Array<{
    kid: string;
    cert: string;
  }>;
}

/**
 * JWTヘッダーの型定義
 */
interface JwtHeader {
  alg: string;
  kid: string;
  typ: string;
}

// 公開鍵のキャッシュ（メモリ内）
const keyCache = new Map<string, { key: CryptoKey; expires: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1時間

/**
 * 認証ミドルウェア
 * - 本番環境: Cloudflare AccessのJWTを検証（署名検証含む）
 * - 開発環境: SKIP_AUTH=trueでスキップ可能
 */
export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const env = c.env;

  // 開発環境での認証スキップ
  // 警告: 本番環境では必ずSKIP_AUTH=falseにすること
  if (env.SKIP_AUTH === 'true') {
    console.warn('警告: 認証がスキップされています（開発モード）');
    const testUser = await findOrCreateUser(c.env.DB, 'test@example.com', 'テストユーザー');
    c.set('user', { email: testUser.email, name: testUser.name || undefined });
    c.set('userId', testUser.id);
    return next();
  }

  // Cloudflare Accessのヘッダーを取得
  const cfAccessJwt = c.req.header('Cf-Access-Jwt-Assertion');
  const cfAccessEmail = c.req.header('Cf-Access-Authenticated-User-Email');

  // JWTがない場合は401エラー
  if (!cfAccessJwt) {
    return c.json({ error: '認証が必要です' }, 401);
  }

  try {
    // JWTの検証（署名検証含む）
    const payload = await verifyAccessToken(
      cfAccessJwt,
      env.ACCESS_TEAM_NAME,
      env.ACCESS_AUD
    );

    if (!payload) {
      return c.json({ error: '無効なトークンです' }, 401);
    }

    // ユーザーをDB上で検索または作成
    const email = payload.email || cfAccessEmail;
    if (!email) {
      return c.json({ error: 'メールアドレスが取得できません' }, 401);
    }

    const user = await findOrCreateUser(c.env.DB, email, payload.name);

    // コンテキストにユーザー情報を設定
    c.set('user', { email: user.email, name: user.name || undefined });
    c.set('userId', user.id);

    return next();
  } catch (_error) {
    // エラー詳細はログに出力しない（セキュリティ対策）
    return c.json({ error: '認証に失敗しました' }, 401);
  }
}

/**
 * Cloudflare AccessのJWTを検証（署名検証含む）
 */
async function verifyAccessToken(
  token: string,
  teamName?: string,
  expectedAud?: string
): Promise<AccessJwtPayload | null> {
  try {
    // JWTの構造を確認
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // ヘッダーをデコード
    const headerJson = base64UrlDecode(parts[0]);
    const header = JSON.parse(headerJson) as JwtHeader;

    // ペイロードをデコード
    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson) as AccessJwtPayload;

    // 有効期限チェック
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }

    // 発行者チェック（teamNameが指定されている場合）
    if (teamName) {
      const expectedIss = `https://${teamName}.cloudflareaccess.com`;
      if (payload.iss !== expectedIss) {
        return null;
      }

      // 署名検証（teamNameが指定されている場合のみ）
      const isValid = await verifySignature(token, teamName, header.kid);
      if (!isValid) {
        return null;
      }
    }

    // AUDチェック（指定されている場合）
    if (expectedAud && !payload.aud.includes(expectedAud)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * JWT署名を検証
 */
async function verifySignature(
  token: string,
  teamName: string,
  kid: string
): Promise<boolean> {
  try {
    // 公開鍵を取得（キャッシュから、またはJWKSエンドポイントから）
    const publicKey = await getPublicKey(teamName, kid);
    if (!publicKey) {
      return false;
    }

    // JWTの各部分を取得
    const parts = token.split('.');
    const signatureInput = `${parts[0]}.${parts[1]}`;
    const signature = base64UrlToArrayBuffer(parts[2]);

    // 署名を検証
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureInput);

    const isValid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey,
      signature,
      data
    );

    return isValid;
  } catch {
    return false;
  }
}

/**
 * Cloudflare Accessの公開鍵を取得
 */
async function getPublicKey(
  teamName: string,
  kid: string
): Promise<CryptoKey | null> {
  const cacheKey = `${teamName}:${kid}`;
  const cached = keyCache.get(cacheKey);

  // キャッシュが有効な場合は使用
  if (cached && cached.expires > Date.now()) {
    return cached.key;
  }

  try {
    // JWKSエンドポイントから公開鍵を取得
    const certsUrl = `https://${teamName}.cloudflareaccess.com/cdn-cgi/access/certs`;
    const response = await fetch(certsUrl);

    if (!response.ok) {
      return null;
    }

    const jwks = (await response.json()) as JwksResponse;

    // 指定されたkidに一致する鍵を検索
    const jwk = jwks.keys.find((k) => k.kid === kid);
    if (!jwk) {
      return null;
    }

    // JWKをCryptoKeyにインポート
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      {
        kty: jwk.kty,
        e: jwk.e,
        n: jwk.n,
        alg: jwk.alg,
        use: jwk.use,
      },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // キャッシュに保存
    keyCache.set(cacheKey, {
      key: publicKey,
      expires: Date.now() + CACHE_TTL,
    });

    return publicKey;
  } catch {
    return null;
  }
}

/**
 * Base64 URL デコード
 */
function base64UrlDecode(str: string): string {
  // Base64 URL を標準 Base64 に変換
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

  // パディングを追加
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }

  return atob(base64);
}

/**
 * Base64 URL を ArrayBuffer に変換
 */
function base64UrlToArrayBuffer(str: string): ArrayBuffer {
  const decoded = base64UrlDecode(str);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 認証情報をテンプレート用に取得するヘルパー
 */
export function getAuthInfo(c: Context<{ Variables: Variables }>) {
  return {
    user: c.get('user'),
    userId: c.get('userId'),
  };
}
