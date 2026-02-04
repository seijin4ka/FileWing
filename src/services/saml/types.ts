/**
 * SAML型定義
 */

/**
 * SAML設定
 */
export interface SAMLConfig {
  /** SP Entity ID（通常はアプリケーションのURL） */
  entityId: string;
  /** ACS URL（SAMLResponse受信エンドポイント） */
  callbackUrl: string;
  /** IdP SSO URL */
  idpSsoUrl: string;
  /** IdP Entity ID */
  idpEntityId: string;
  /** IdP X.509証明書（PEM形式） */
  idpCert: string;
}

/**
 * AuthnRequest生成オプション
 */
export interface AuthnRequestOptions {
  /** リクエストID（省略時は自動生成） */
  id?: string;
  /** Destination URL（IdP SSO URL） */
  destination: string;
  /** Issuer（SP Entity ID） */
  issuer: string;
  /** ACS URL */
  assertionConsumerServiceUrl: string;
}

/**
 * AuthnRequestの結果
 */
export interface AuthnRequestResult {
  /** リクエストID */
  id: string;
  /** リダイレクトURL（SAMLRequest含む） */
  redirectUrl: string;
}

/**
 * SAML Assertion
 */
export interface SAMLAssertion {
  /** Assertion ID */
  id: string;
  /** 発行者（IdP Entity ID） */
  issuer: string;
  /** Subject（通常はNameID） */
  subject: SAMLSubject;
  /** 条件 */
  conditions: SAMLConditions;
  /** 属性 */
  attributes: Record<string, string>;
}

/**
 * SAML Subject
 */
export interface SAMLSubject {
  /** NameID値 */
  nameId: string;
  /** NameID形式 */
  format: string;
}

/**
 * SAML Conditions
 */
export interface SAMLConditions {
  /** 有効開始時刻（ISO 8601） */
  notBefore?: string;
  /** 有効終了時刻（ISO 8601） */
  notOnOrAfter?: string;
  /** Audience Restriction */
  audience?: string;
}

/**
 * SAMLResponse解析結果
 */
export interface SAMLResponseResult {
  /** 成功フラグ */
  success: boolean;
  /** Assertion（成功時のみ） */
  assertion?: SAMLAssertion;
  /** エラーメッセージ（失敗時のみ） */
  error?: string;
}

/**
 * SAMLユーザー情報
 */
export interface SAMLUser {
  /** メールアドレス（NameIDまたは属性から） */
  email: string;
  /** 表示名（属性から、オプション） */
  name?: string;
}
