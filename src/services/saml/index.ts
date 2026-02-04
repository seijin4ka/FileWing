/**
 * SAML Service Provider
 * 各モジュールをエクスポート
 */

// 型定義
export type {
  SAMLConfig,
  AuthnRequestOptions,
  AuthnRequestResult,
  SAMLAssertion,
  SAMLSubject,
  SAMLConditions,
  SAMLResponseResult,
  SAMLUser,
} from './types';

// AuthnRequest生成
export { createAuthnRequest, createAuthnRequestWithRelayState, createAuthnRequestXml } from './request';

// SAMLResponse解析
export { parseSAMLResponse, extractUserFromAssertion } from './response';

// SPメタデータ
export { generateSpMetadata } from './metadata';
