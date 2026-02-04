/**
 * 認証ルート
 * SAML SSO認証のエンドポイント
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';
import {
  createAuthnRequest,
  parseSAMLResponse,
  extractUserFromAssertion,
  generateSpMetadata,
  type SAMLConfig,
} from '../../services/saml';
import {
  createSessionToken,
  createSessionCookie,
  createLogoutCookie,
  getSessionMaxAge,
} from '../../services/session';

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * SAML設定を環境変数から取得
 */
function getSAMLConfig(env: Env): SAMLConfig | null {
  if (
    !env.SAML_ENTITY_ID ||
    !env.SAML_IDP_SSO_URL ||
    !env.SAML_IDP_ENTITY_ID ||
    !env.SAML_CALLBACK_URL ||
    !env.SAML_IDP_CERT
  ) {
    return null;
  }

  return {
    entityId: env.SAML_ENTITY_ID,
    callbackUrl: env.SAML_CALLBACK_URL,
    idpSsoUrl: env.SAML_IDP_SSO_URL,
    idpEntityId: env.SAML_IDP_ENTITY_ID,
    idpCert: env.SAML_IDP_CERT,
  };
}

/**
 * ドメイン制限をチェック
 */
function isDomainAllowed(email: string, allowedDomains?: string): boolean {
  if (!allowedDomains) {
    // ドメイン制限なし = 全ドメイン許可
    return true;
  }

  const domains = allowedDomains.split(',').map((d) => d.trim().toLowerCase());
  const emailDomain = email.split('@')[1]?.toLowerCase();

  if (!emailDomain) {
    return false;
  }

  return domains.includes(emailDomain);
}

/**
 * GET /auth/login
 * SAML認証開始、IdPにリダイレクト
 */
auth.get('/login', async (c) => {
  const config = getSAMLConfig(c.env);

  if (!config) {
    console.error('SAML configuration is incomplete');
    return c.redirect('/login?error=config');
  }

  // AuthnRequestを生成
  const { redirectUrl } = createAuthnRequest({
    destination: config.idpSsoUrl,
    issuer: config.entityId,
    assertionConsumerServiceUrl: config.callbackUrl,
  });

  // IdPにリダイレクト
  return c.redirect(redirectUrl);
});

/**
 * POST /auth/saml/callback
 * SAMLResponse受信、検証、セッション作成
 */
auth.post('/saml/callback', async (c) => {
  const config = getSAMLConfig(c.env);
  if (!config) {
    console.error('SAML configuration is incomplete');
    return c.redirect('/login?error=config');
  }

  // POSTボディを取得
  const formData = await c.req.formData();
  const samlResponse = formData.get('SAMLResponse');

  if (!samlResponse || typeof samlResponse !== 'string') {
    console.error('SAMLResponse not found in request');
    return c.redirect('/login?error=response');
  }

  // SAMLResponseを解析・検証
  const result = await parseSAMLResponse(samlResponse, config);

  if (!result.success || !result.assertion) {
    console.error('SAML Response validation failed:', result.error);
    return c.redirect('/login?error=validation');
  }

  // ユーザー情報を抽出
  const user = extractUserFromAssertion(result.assertion);

  if (!user.email) {
    console.error('Email not found in SAML Assertion');
    return c.redirect('/login?error=email');
  }

  // ドメイン制限をチェック
  if (!isDomainAllowed(user.email, c.env.ALLOWED_DOMAINS)) {
    console.warn(`Domain not allowed: ${user.email}`);
    return c.redirect('/login?error=domain');
  }

  // セッショントークンを生成
  const sessionSecret = c.env.SESSION_SECRET;
  if (!sessionSecret) {
    console.error('SESSION_SECRET is not configured');
    return c.redirect('/login?error=config');
  }

  const maxAge = getSessionMaxAge(c.env.SESSION_MAX_AGE);
  const isSecure = c.req.url.startsWith('https://');

  const token = await createSessionToken(
    {
      sub: user.email,
      name: user.name,
      provider: 'google-saml',
    },
    sessionSecret,
    maxAge
  );

  // セッションCookieを設定
  const cookie = createSessionCookie(token, maxAge, isSecure);

  // ダッシュボードにリダイレクト（Cookieヘッダー付き）
  const appUrl = c.env.APP_URL || '/';
  return new Response(null, {
    status: 302,
    headers: {
      Location: appUrl,
      'Set-Cookie': cookie,
    },
  });
});

/**
 * GET /auth/saml/metadata
 * SP メタデータ（XML）を返す
 */
auth.get('/saml/metadata', async (c) => {
  const entityId = c.env.SAML_ENTITY_ID;
  const callbackUrl = c.env.SAML_CALLBACK_URL;

  if (!entityId || !callbackUrl) {
    return c.json({ error: 'SAML configuration is incomplete' }, 500);
  }

  const metadata = generateSpMetadata({ entityId, callbackUrl });

  return c.text(metadata, 200, {
    'Content-Type': 'application/xml',
  });
});

/**
 * GET/POST /auth/logout
 * セッション破棄、ログアウト
 */
auth.all('/logout', async () => {
  // セッションCookieを削除
  const cookie = createLogoutCookie();

  // ログインページにリダイレクト（Cookieヘッダー付き）
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/login',
      'Set-Cookie': cookie,
    },
  });
});

export default auth;
