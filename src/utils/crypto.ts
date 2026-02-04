/**
 * 暗号化ユーティリティ
 * パスワードハッシュ、定数時間比較などのセキュリティ関連関数
 */

// PBKDF2のパラメータ
const PBKDF2_ITERATIONS = 100000; // 反復回数
const SALT_LENGTH = 16; // ソルト長（バイト）
const HASH_LENGTH = 32; // ハッシュ長（バイト）

/**
 * パスワードをハッシュ化（PBKDF2）
 * 形式: iterations:salt:hash（すべてhex文字列）
 */
export async function hashPassword(password: string): Promise<string> {
  // ランダムなソルトを生成
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  // パスワードをキーとしてインポート
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  // PBKDF2でハッシュを導出
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    HASH_LENGTH * 8 // ビット数
  );

  // バイナリをhex文字列に変換
  const saltHex = arrayBufferToHex(salt);
  const hashHex = arrayBufferToHex(new Uint8Array(hashBuffer));

  // 形式: iterations:salt:hash
  return `${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;
}

/**
 * パスワードを検証
 * ハッシュ形式: iterations:salt:hash
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    // 旧形式（SHA-256のみ）のサポート
    if (!storedHash.includes(':')) {
      // 旧形式: 単純なSHA-256ハッシュ
      return await verifyLegacyPassword(password, storedHash);
    }

    // 新形式をパース
    const parts = storedHash.split(':');
    if (parts.length !== 3) {
      return false;
    }

    const iterations = parseInt(parts[0], 10);
    const salt = hexToArrayBuffer(parts[1]);
    const expectedHash = parts[2];

    // パスワードをキーとしてインポート
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    // PBKDF2でハッシュを導出
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256',
      },
      passwordKey,
      HASH_LENGTH * 8
    );

    const computedHash = arrayBufferToHex(new Uint8Array(hashBuffer));

    // 定数時間比較
    return timingSafeEqual(computedHash, expectedHash);
  } catch {
    return false;
  }
}

/**
 * 旧形式のパスワードを検証（SHA-256のみ）
 * 後方互換性のため
 */
async function verifyLegacyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const computedHash = arrayBufferToHex(new Uint8Array(hashBuffer));

  return timingSafeEqual(computedHash, storedHash);
}

/**
 * 定数時間文字列比較
 * タイミング攻撃を防止
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // 長さが異なる場合もダミー比較を実行
    const dummy = 'x'.repeat(a.length);
    timingSafeEqualInternal(dummy, a);
    return false;
  }
  return timingSafeEqualInternal(a, b);
}

/**
 * 内部の定数時間比較
 */
function timingSafeEqualInternal(a: string, b: string): boolean {
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * ArrayBufferをhex文字列に変換
 */
function arrayBufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * hex文字列をArrayBufferに変換
 */
function hexToArrayBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}
