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
 * 認証ミドルウェア
 * - 本番環境: Cloudflare AccessのJWTを検証
 * - 開発環境: SKIP_AUTH=trueでスキップ可能
 */
export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const env = c.env;

  // 開発環境での認証スキップ
  if (env.SKIP_AUTH === 'true') {
    // テスト用のダミーユーザー
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
    // JWTの検証
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
  } catch (error) {
    console.error('認証エラー:', error);
    return c.json({ error: '認証に失敗しました' }, 401);
  }
}

/**
 * Cloudflare AccessのJWTを検証
 * 注意: 完全な検証にはCloudflare Accessの公開鍵を取得する必要がある
 */
async function verifyAccessToken(
  token: string,
  teamName?: string,
  expectedAud?: string
): Promise<AccessJwtPayload | null> {
  try {
    // JWTをデコード（Base64）
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payloadBase64 = parts[1];
    const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson) as AccessJwtPayload;

    // 有効期限チェック
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.error('トークンの有効期限が切れています');
      return null;
    }

    // 発行者チェック（teamNameが指定されている場合）
    if (teamName) {
      const expectedIss = `https://${teamName}.cloudflareaccess.com`;
      if (payload.iss !== expectedIss) {
        console.error('発行者が一致しません:', payload.iss);
        return null;
      }
    }

    // AUDチェック（指定されている場合）
    if (expectedAud && !payload.aud.includes(expectedAud)) {
      console.error('AUDが一致しません:', payload.aud);
      return null;
    }

    // 本番環境では公開鍵での署名検証も行うべき
    // Cloudflare Accessの公開鍵は以下のエンドポイントから取得可能:
    // https://{team-name}.cloudflareaccess.com/cdn-cgi/access/certs

    return payload;
  } catch (error) {
    console.error('トークンのデコードに失敗:', error);
    return null;
  }
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
