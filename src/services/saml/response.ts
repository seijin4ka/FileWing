/**
 * SAML Response解析・検証
 * IdP → SP へのレスポンスを検証し、ユーザー情報を抽出
 */

import type {
  SAMLConfig,
  SAMLResponseResult,
  SAMLAssertion,
  SAMLSubject,
  SAMLConditions,
  SAMLUser,
} from './types';

/**
 * SAMLResponseを解析・検証
 */
export async function parseSAMLResponse(
  samlResponse: string,
  config: SAMLConfig
): Promise<SAMLResponseResult> {
  try {
    // Base64デコード
    const xml = atob(samlResponse);

    // XML解析
    const parsed = parseXml(xml);

    // Statusチェック
    const status = extractStatus(parsed);
    if (status !== 'urn:oasis:names:tc:SAML:2.0:status:Success') {
      return { success: false, error: `SAML Status error: ${status}` };
    }

    // Assertionを抽出
    const assertionXml = extractAssertion(parsed);
    if (!assertionXml) {
      return { success: false, error: 'Assertion not found in SAML Response' };
    }

    // 署名検証
    const signatureValid = await verifySignature(xml, config.idpCert);
    if (!signatureValid) {
      return { success: false, error: 'Invalid signature' };
    }

    // Issuer検証
    const issuer = extractIssuer(assertionXml);
    if (issuer !== config.idpEntityId) {
      return { success: false, error: `Invalid Issuer: expected ${config.idpEntityId}, got ${issuer}` };
    }

    // Conditions検証
    const conditions = extractConditions(assertionXml);
    const conditionsError = validateConditions(conditions, config.entityId);
    if (conditionsError) {
      return { success: false, error: conditionsError };
    }

    // Subject抽出
    const subject = extractSubject(assertionXml);
    if (!subject) {
      return { success: false, error: 'Subject not found' };
    }

    // 属性抽出
    const attributes = extractAttributes(assertionXml);

    // Assertionを構築
    const assertion: SAMLAssertion = {
      id: extractAssertionId(assertionXml) || '',
      issuer,
      subject,
      conditions,
      attributes,
    };

    return { success: true, assertion };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to parse SAML Response: ${message}` };
  }
}

/**
 * SAMLAssertionからユーザー情報を抽出
 */
export function extractUserFromAssertion(assertion: SAMLAssertion): SAMLUser {
  // NameIDからメールを取得
  let email = assertion.subject.nameId;

  // 属性からメールを上書き（あれば）
  if (assertion.attributes.email) {
    email = assertion.attributes.email;
  }

  // 表示名を取得
  const name =
    assertion.attributes.displayName ||
    assertion.attributes.name ||
    assertion.attributes.firstName ||
    undefined;

  return { email, name };
}

// =====================================================
// XML解析ヘルパー（簡易実装）
// =====================================================

interface ParsedXml {
  raw: string;
}

function parseXml(xml: string): ParsedXml {
  return { raw: xml };
}

function extractStatus(parsed: ParsedXml): string {
  // <samlp:StatusCode Value="..."/> を抽出
  const match = parsed.raw.match(/<samlp?:StatusCode[^>]*Value="([^"]+)"/i);
  return match ? match[1] : 'unknown';
}

function extractAssertion(parsed: ParsedXml): string | null {
  // <saml:Assertion> ... </saml:Assertion> を抽出
  const match = parsed.raw.match(/<saml:Assertion[^>]*>[\s\S]*?<\/saml:Assertion>/i);
  return match ? match[0] : null;
}

function extractAssertionId(assertionXml: string): string | null {
  const match = assertionXml.match(/<saml:Assertion[^>]*\sID="([^"]+)"/i);
  return match ? match[1] : null;
}

function extractIssuer(assertionXml: string): string {
  // <saml:Issuer>...</saml:Issuer> を抽出
  const match = assertionXml.match(/<saml:Issuer[^>]*>([^<]+)<\/saml:Issuer>/i);
  return match ? match[1].trim() : '';
}

function extractConditions(assertionXml: string): SAMLConditions {
  const conditions: SAMLConditions = {};

  // <saml:Conditions NotBefore="..." NotOnOrAfter="...">
  const conditionsMatch = assertionXml.match(
    /<saml:Conditions[^>]*NotBefore="([^"]*)"[^>]*NotOnOrAfter="([^"]*)"/i
  );
  if (conditionsMatch) {
    conditions.notBefore = conditionsMatch[1];
    conditions.notOnOrAfter = conditionsMatch[2];
  } else {
    // 順序が逆の場合
    const altMatch = assertionXml.match(
      /<saml:Conditions[^>]*NotOnOrAfter="([^"]*)"[^>]*NotBefore="([^"]*)"/i
    );
    if (altMatch) {
      conditions.notOnOrAfter = altMatch[1];
      conditions.notBefore = altMatch[2];
    }
  }

  // <saml:Audience>...</saml:Audience>
  const audienceMatch = assertionXml.match(/<saml:Audience[^>]*>([^<]+)<\/saml:Audience>/i);
  if (audienceMatch) {
    conditions.audience = audienceMatch[1].trim();
  }

  return conditions;
}

function extractSubject(assertionXml: string): SAMLSubject | null {
  // <saml:NameID Format="...">...</saml:NameID>
  const match = assertionXml.match(/<saml:NameID[^>]*Format="([^"]*)"[^>]*>([^<]+)<\/saml:NameID>/i);
  if (match) {
    return {
      format: match[1],
      nameId: match[2].trim(),
    };
  }

  // Formatなしの場合
  const simpleMatch = assertionXml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/i);
  if (simpleMatch) {
    return {
      format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
      nameId: simpleMatch[1].trim(),
    };
  }

  return null;
}

function extractAttributes(assertionXml: string): Record<string, string> {
  const attributes: Record<string, string> = {};

  // <saml:Attribute Name="..."><saml:AttributeValue>...</saml:AttributeValue></saml:Attribute>
  const attrPattern =
    /<saml:Attribute[^>]*Name="([^"]+)"[^>]*>[\s\S]*?<saml:AttributeValue[^>]*>([^<]*)<\/saml:AttributeValue>/gi;

  let match;
  while ((match = attrPattern.exec(assertionXml)) !== null) {
    const name = match[1];
    const value = match[2].trim();

    // 属性名を正規化（URLの場合は最後の部分を使用）
    const normalizedName = normalizeAttributeName(name);
    attributes[normalizedName] = value;
  }

  return attributes;
}

function normalizeAttributeName(name: string): string {
  // URLの場合は最後のパス部分を取得
  if (name.startsWith('http://') || name.startsWith('https://')) {
    const parts = name.split('/');
    return parts[parts.length - 1];
  }

  // urn:oid: の場合は標準的な名前にマップ
  const oidMap: Record<string, string> = {
    'urn:oid:0.9.2342.19200300.100.1.3': 'email',
    'urn:oid:2.5.4.42': 'firstName',
    'urn:oid:2.5.4.4': 'lastName',
    'urn:oid:2.16.840.1.113730.3.1.241': 'displayName',
  };

  return oidMap[name] || name;
}

function validateConditions(conditions: SAMLConditions, expectedAudience: string): string | null {
  const now = new Date();

  // NotBefore チェック
  if (conditions.notBefore) {
    const notBefore = new Date(conditions.notBefore);
    // 5分の猶予を許容（クロック同期の問題対策）
    notBefore.setMinutes(notBefore.getMinutes() - 5);
    if (now < notBefore) {
      return `Assertion not yet valid (NotBefore: ${conditions.notBefore})`;
    }
  }

  // NotOnOrAfter チェック
  if (conditions.notOnOrAfter) {
    const notOnOrAfter = new Date(conditions.notOnOrAfter);
    // 5分の猶予を許容
    notOnOrAfter.setMinutes(notOnOrAfter.getMinutes() + 5);
    if (now > notOnOrAfter) {
      return `Assertion expired (NotOnOrAfter: ${conditions.notOnOrAfter})`;
    }
  }

  // Audience チェック
  if (conditions.audience && conditions.audience !== expectedAudience) {
    return `Invalid Audience: expected ${expectedAudience}, got ${conditions.audience}`;
  }

  return null;
}

// =====================================================
// 署名検証
// =====================================================

/**
 * XML署名を検証
 * Google SAML IdPからの署名を検証
 */
async function verifySignature(xml: string, idpCertBase64: string): Promise<boolean> {
  try {
    // 署名値を抽出
    const signatureMatch = xml.match(/<ds:SignatureValue[^>]*>([^<]+)<\/ds:SignatureValue>/i);
    if (!signatureMatch) {
      console.error('Signature value not found in SAML Response');
      return false;
    }
    const signatureValue = signatureMatch[1].replace(/\s/g, '');

    // SignedInfo要素を抽出
    const signedInfoMatch = xml.match(/<ds:SignedInfo[^>]*>[\s\S]*?<\/ds:SignedInfo>/i);
    if (!signedInfoMatch) {
      console.error('SignedInfo not found in SAML Response');
      return false;
    }

    // SignedInfoを正規化（Canonical XML）
    // 簡易実装: 改行・空白を正規化
    const signedInfo = canonicalizeXml(signedInfoMatch[0]);

    // X.509証明書をCryptoKeyにインポート
    const publicKey = await importX509Certificate(idpCertBase64);
    if (!publicKey) {
      console.error('Failed to import X.509 certificate');
      return false;
    }

    // 署名を検証
    const signatureBytes = base64ToArrayBuffer(signatureValue);
    const dataBytes = new TextEncoder().encode(signedInfo);

    const isValid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey,
      signatureBytes,
      dataBytes
    );

    return isValid;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * XMLを正規化（簡易実装）
 */
function canonicalizeXml(xml: string): string {
  // 名前空間宣言を追加（SignedInfo単独で検証する場合に必要）
  let result = xml;

  // ds名前空間が宣言されていない場合は追加
  if (!result.includes('xmlns:ds=')) {
    result = result.replace(
      '<ds:SignedInfo',
      '<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"'
    );
  }

  // 不要な空白を削除（簡易正規化）
  result = result.replace(/>\s+</g, '><');

  return result;
}

/**
 * Base64エンコードされたX.509証明書をCryptoKeyにインポート
 */
async function importX509Certificate(certBase64: string): Promise<CryptoKey | null> {
  try {
    // PEMヘッダー/フッターを除去
    const pemContent = certBase64
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '');

    // Base64デコード
    const certBytes = base64ToArrayBuffer(pemContent);

    // 証明書からSubjectPublicKeyInfoを抽出
    // X.509証明書の簡易解析
    const publicKeyInfo = extractPublicKeyFromCert(certBytes);
    if (!publicKeyInfo) {
      return null;
    }

    // CryptoKeyにインポート
    return await crypto.subtle.importKey(
      'spki',
      publicKeyInfo,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
  } catch (error) {
    console.error('Certificate import error:', error);
    return null;
  }
}

/**
 * X.509証明書からSubjectPublicKeyInfoを抽出（簡易実装）
 */
function extractPublicKeyFromCert(certBytes: ArrayBuffer): ArrayBuffer | null {
  // ASN.1 DER形式の証明書を解析
  // 簡易実装: 証明書全体を返す（Web Crypto APIは証明書からSPKIを自動抽出できる場合がある）
  // 本格的な実装にはASN.1パーサーが必要

  try {
    const bytes = new Uint8Array(certBytes);

    // TBSCertificateの開始位置を探す（SEQUENCE OF SEQUENCE）
    // 最初のSEQUENCEを飛ばして、内部のSEQUENCE（TBSCertificate）を解析

    let pos = 0;

    // 外側のSEQUENCEをスキップ
    if (bytes[pos] !== 0x30) return null;
    pos++;
    const outerLen = readLength(bytes, pos);
    pos = outerLen.nextPos;

    // TBSCertificate SEQUENCE
    if (bytes[pos] !== 0x30) return null;
    pos++;
    const tbsLen = readLength(bytes, pos);
    pos = tbsLen.nextPos;

    // version [0] (optional)
    if (bytes[pos] === 0xa0) {
      pos++;
      const verLen = readLength(bytes, pos);
      pos = verLen.nextPos + verLen.length;
    }

    // serialNumber
    if (bytes[pos] !== 0x02) return null;
    pos++;
    const serialLen = readLength(bytes, pos);
    pos = serialLen.nextPos + serialLen.length;

    // signature algorithm
    if (bytes[pos] !== 0x30) return null;
    pos++;
    const sigAlgLen = readLength(bytes, pos);
    pos = sigAlgLen.nextPos + sigAlgLen.length;

    // issuer
    if (bytes[pos] !== 0x30) return null;
    pos++;
    const issuerLen = readLength(bytes, pos);
    pos = issuerLen.nextPos + issuerLen.length;

    // validity
    if (bytes[pos] !== 0x30) return null;
    pos++;
    const validityLen = readLength(bytes, pos);
    pos = validityLen.nextPos + validityLen.length;

    // subject
    if (bytes[pos] !== 0x30) return null;
    pos++;
    const subjectLen = readLength(bytes, pos);
    pos = subjectLen.nextPos + subjectLen.length;

    // subjectPublicKeyInfo - これが欲しい
    if (bytes[pos] !== 0x30) return null;
    const spkiStart = pos;
    pos++;
    const spkiLen = readLength(bytes, pos);
    const spkiEnd = spkiLen.nextPos + spkiLen.length;

    return bytes.slice(spkiStart, spkiEnd).buffer;
  } catch {
    return null;
  }
}

/**
 * ASN.1 DER長さフィールドを読み取り
 */
function readLength(bytes: Uint8Array, pos: number): { length: number; nextPos: number } {
  const firstByte = bytes[pos];

  if (firstByte < 0x80) {
    // Short form
    return { length: firstByte, nextPos: pos + 1 };
  }

  // Long form
  const numOctets = firstByte & 0x7f;
  let length = 0;
  for (let i = 0; i < numOctets; i++) {
    length = (length << 8) | bytes[pos + 1 + i];
  }

  return { length, nextPos: pos + 1 + numOctets };
}

/**
 * Base64をArrayBufferに変換
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
