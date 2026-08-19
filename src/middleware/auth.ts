/**
 * 認証ミドルウェア
 * AUTH_METHOD環境変数に基づいて認証方式を切り替え
 * - 'saml': SAML SSO認証（セッションベース）
 * - 'cloudflare-access': Cloudflare Access JWT認証
 * - 'local': ローカル認証（管理者登録方式、セッションベース）
 * - 'skip': 認証スキップ（開発用）
 *
 * 後方互換: SKIP_AUTH=true は AUTH_METHOD='skip' と同等
 */

import { Context, Next } from 'hono';
import type { Env, Variables } from '../types';
import { findOrCreateUser, findUserByEmail, hasAdminUser } from '../services/d1';
import { getSessionSecret } from '../services/settings';
import {
  verifySessionToken,
  getSessionTokenFromCookie,
} from '../services/session';

/** 認証方式 */
type AuthMethod = 'saml' | 'cloudflare-access' | 'local' | 'skip';

/**
 * 認証方式を判定
 */
function getAuthMethod(env: Env): AuthMethod {
  // AUTH_METHODが明示的に設定されている場合はそれを使用
  if (env.AUTH_METHOD) {
    const method = env.AUTH_METHOD.toLowerCase();
    if (
      method === 'saml' ||
      method === 'cloudflare-access' ||
      method === 'local' ||
      method === 'skip'
    ) {
      return method;
    }
  }

  // 後方互換: SKIP_AUTH=true は 'skip' と同等
  if (env.SKIP_AUTH === 'true') {
    return 'skip';
  }

  // SAML設定が完全な場合はSAML認証
  if (
    env.SAML_ENTITY_ID &&
    env.SAML_IDP_SSO_URL &&
    env.SAML_IDP_ENTITY_ID &&
    env.SAML_CALLBACK_URL &&
    env.SAML_IDP_CERT &&
    env.SESSION_SECRET
  ) {
    return 'saml';
  }

  // Cloudflare Access設定がある場合はCloudflare Access認証
  if (env.ACCESS_TEAM_NAME || env.ACCESS_AUD) {
    return 'cloudflare-access';
  }

  // デフォルトはローカル認証
  // 認証設定が何もない状態で 'skip' を返すと認証なしで公開されてしまうため、
  // 管理者登録を要求する 'local' をフォールバックとする
  return 'local';
}

/**
 * 認証ミドルウェア（統合）
 * 環境変数に基づいて適切な認証方式を選択
 */
export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const authMethod = getAuthMethod(c.env);

  switch (authMethod) {
    case 'skip':
      return skipAuthMiddleware(c, next);
    case 'cloudflare-access':
      return cloudflareAccessAuthMiddleware(c, next);
    case 'saml':
      return samlAuthMiddleware(c, next);
    case 'local':
      return localAuthMiddleware(c, next);
    default:
      return skipAuthMiddleware(c, next);
  }
}

/**
 * 認証スキップミドルウェア（開発用）
 */
async function skipAuthMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  console.warn('警告: 認証がスキップされています（開発モード）');
  const testUser = await findOrCreateUser(c.env.DB, 'test@example.com', 'テストユーザー');
  c.set('user', { email: testUser.email, name: testUser.name || undefined, provider: 'test' });
  c.set('userId', testUser.id);
  return next();
}

/**
 * ローカル認証ミドルウェア（管理者登録方式）
 *
 * セッションCookieのJWTを検証する。有効なセッションがない場合は、
 * 管理者が未登録なら登録ページへ、登録済みならログインページへ誘導する。
 * これにより公開直後は管理者登録画面が最初に表示される。
 */
async function localAuthMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const env = c.env;

  // 署名キーを取得（環境変数優先、未設定ならD1に保存した値を使用）
  const sessionSecret = await getSessionSecret(env.DB, env.SESSION_SECRET);

  const cookieHeader = c.req.header('Cookie');
  const token = getSessionTokenFromCookie(cookieHeader);

  if (!token) {
    return redirectToLocalEntry(c);
  }

  const payload = await verifySessionToken(token, sessionSecret);

  if (!payload) {
    return redirectToLocalEntry(c, 'session');
  }

  // セッションのユーザーが実在するかを確認（削除済みユーザーの締め出し）
  const user = await findUserByEmail(env.DB, payload.sub);

  if (!user) {
    return redirectToLocalEntry(c, 'session');
  }

  c.set('user', {
    email: user.email,
    name: user.name || undefined,
    provider: payload.provider,
  });
  c.set('userId', user.id);

  return next();
}

/**
 * ローカル認証で未認証だった場合の誘導先を決める
 * 管理者未登録なら /register、登録済みなら /login
 */
async function redirectToLocalEntry(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  error?: string
) {
  const adminExists = await hasAdminUser(c.env.DB);

  if (c.req.path.startsWith('/api/')) {
    return c.json({ success: false, error: '認証が必要です' }, 401);
  }

  if (!adminExists) {
    return c.redirect('/register', 302);
  }

  const url = error ? `/login?error=${error}` : '/login';
  return c.redirect(url, 302);
}

/**
 * SAML SSO認証ミドルウェア
 * セッションCookieのJWTを検証
 */
async function samlAuthMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const env = c.env;

  // セッションシークレットが設定されていない場合はエラー
  if (!env.SESSION_SECRET) {
    console.error('SESSION_SECRET is not configured');
    return redirectToLogin(c);
  }

  // セッションCookieからJWTを取得
  const cookieHeader = c.req.header('Cookie');
  const token = getSessionTokenFromCookie(cookieHeader);

  if (!token) {
    return redirectToLogin(c);
  }

  // JWTを検証
  const payload = await verifySessionToken(token, env.SESSION_SECRET);

  if (!payload) {
    return redirectToLogin(c, 'session');
  }

  // ドメイン制限をチェック（設定されている場合）
  if (env.ALLOWED_DOMAINS && !isDomainAllowed(payload.sub, env.ALLOWED_DOMAINS)) {
    return redirectToLogin(c, 'domain');
  }

  // ユーザーをDB上で検索または作成
  const user = await findOrCreateUser(c.env.DB, payload.sub, payload.name);

  // コンテキストにユーザー情報を設定
  c.set('user', {
    email: user.email,
    name: user.name || undefined,
    provider: payload.provider,
  });
  c.set('userId', user.id);

  return next();
}

/**
 * ドメイン制限をチェック
 */
function isDomainAllowed(email: string, allowedDomains: string): boolean {
  const domains = allowedDomains.split(',').map((d) => d.trim().toLowerCase());
  const emailDomain = email.split('@')[1]?.toLowerCase();

  if (!emailDomain) {
    return false;
  }

  return domains.includes(emailDomain);
}

/**
 * ログインページにリダイレクト
 */
function redirectToLogin(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  error?: string
) {
  // APIリクエストの場合はJSON
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: '認証が必要です' }, 401);
  }

  // それ以外はログインページにリダイレクト
  const url = error ? `/login?error=${error}` : '/login';
  return c.redirect(url, 302);
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

/**
 * 現在の認証方式を取得（テンプレート用）
 */
export function getAuthMethod_forTemplate(env: Env): AuthMethod {
  return getAuthMethod(env);
}

// =====================================================
// Cloudflare Access認証
// =====================================================

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
 * Cloudflare Access認証ミドルウェア
 */
export async function cloudflareAccessAuthMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const env = c.env;

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
    c.set('user', { email: user.email, name: user.name || undefined, provider: 'cloudflare-access' });
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
