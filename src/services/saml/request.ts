/**
 * SAML AuthnRequest生成
 * SP → IdP へのリダイレクトリクエストを構築
 */

import type { AuthnRequestOptions, AuthnRequestResult } from './types';

/**
 * 一意のリクエストIDを生成
 */
function generateRequestId(): string {
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const hex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `_${hex}`;
}

/**
 * ISO 8601形式の現在時刻を取得
 */
function getIssueInstant(): string {
  return new Date().toISOString();
}

/**
 * AuthnRequest XMLを生成
 */
export function createAuthnRequestXml(options: AuthnRequestOptions): { xml: string; id: string } {
  const id = options.id || generateRequestId();
  const issueInstant = getIssueInstant();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${escapeXml(id)}"
  Version="2.0"
  IssueInstant="${escapeXml(issueInstant)}"
  Destination="${escapeXml(options.destination)}"
  AssertionConsumerServiceURL="${escapeXml(options.assertionConsumerServiceUrl)}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${escapeXml(options.issuer)}</saml:Issuer>
  <samlp:NameIDPolicy
    Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
    AllowCreate="true"/>
</samlp:AuthnRequest>`;

  return { xml, id };
}

/**
 * AuthnRequestをエンコードしてリダイレクトURLを構築
 */
export function createAuthnRequest(options: AuthnRequestOptions): AuthnRequestResult {
  const { xml, id } = createAuthnRequestXml(options);

  // Base64エンコード
  // btoaはLatin1範囲の文字しか扱えないため、UTF-8バイト列に変換してから行う
  const bytes = new TextEncoder().encode(xml);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const encoded = btoa(binary);

  // URLエンコード
  const samlRequest = encodeURIComponent(encoded);

  // リダイレクトURLを構築
  // IdPのSSO URLは既にクエリ文字列を含むことがあるため
  // （Google Workspaceの場合は必ず ?idpid=... が付く）、
  // 区切り文字を判定して連結する
  const separator = options.destination.includes('?') ? '&' : '?';
  const redirectUrl = `${options.destination}${separator}SAMLRequest=${samlRequest}`;

  return { id, redirectUrl };
}

/**
 * RelayStateを含むリダイレクトURLを構築
 */
export function createAuthnRequestWithRelayState(
  options: AuthnRequestOptions,
  relayState?: string
): AuthnRequestResult {
  const result = createAuthnRequest(options);

  if (relayState) {
    const encodedRelayState = encodeURIComponent(relayState);
    return {
      ...result,
      redirectUrl: `${result.redirectUrl}&RelayState=${encodedRelayState}`,
    };
  }

  return result;
}

/**
 * XML特殊文字をエスケープ
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
