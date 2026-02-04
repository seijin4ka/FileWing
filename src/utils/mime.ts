/**
 * MIMEタイプ検証ユーティリティ
 * ファイルのマジックバイトを確認してMIMEタイプを検証
 */

/**
 * ファイルシグネチャ（マジックバイト）の定義
 */
const FILE_SIGNATURES: Array<{
  mime: string;
  signatures: Array<{ bytes: number[]; offset?: number }>;
}> = [
  // 画像
  {
    mime: 'image/jpeg',
    signatures: [{ bytes: [0xff, 0xd8, 0xff] }],
  },
  {
    mime: 'image/png',
    signatures: [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  },
  {
    mime: 'image/gif',
    signatures: [
      { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
      { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
    ],
  },
  {
    mime: 'image/webp',
    signatures: [
      { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF
      // WEBPは8バイト目から確認が必要だが、RIFFだけで判定
    ],
  },
  {
    mime: 'image/bmp',
    signatures: [{ bytes: [0x42, 0x4d] }], // BM
  },
  // PDF
  {
    mime: 'application/pdf',
    signatures: [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  },
  // ZIP系（Office文書含む）
  {
    mime: 'application/zip',
    signatures: [{ bytes: [0x50, 0x4b, 0x03, 0x04] }], // PK..
  },
  // RAR
  {
    mime: 'application/vnd.rar',
    signatures: [{ bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07] }], // Rar!..
  },
  // 7z
  {
    mime: 'application/x-7z-compressed',
    signatures: [{ bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] }], // 7z...
  },
  // GZIP
  {
    mime: 'application/gzip',
    signatures: [{ bytes: [0x1f, 0x8b] }],
  },
  // TAR (様々なシグネチャがあるが、ustarが一般的)
  {
    mime: 'application/x-tar',
    signatures: [{ bytes: [0x75, 0x73, 0x74, 0x61, 0x72], offset: 257 }], // ustar
  },
];

/**
 * Office文書のMIMEタイプマッピング（拡張子ベース）
 * ZIPベースのOffice文書は内部を確認する必要があるため、拡張子で判定
 */
const OFFICE_EXTENSIONS: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
};

/**
 * ファイルのマジックバイトからMIMEタイプを検出
 */
export function detectMimeType(
  buffer: ArrayBuffer,
  filename: string
): string | null {
  const bytes = new Uint8Array(buffer);

  for (const { mime, signatures } of FILE_SIGNATURES) {
    for (const sig of signatures) {
      const offset = sig.offset || 0;
      if (offset + sig.bytes.length > bytes.length) continue;

      let match = true;
      for (let i = 0; i < sig.bytes.length; i++) {
        if (bytes[offset + i] !== sig.bytes[i]) {
          match = false;
          break;
        }
      }

      if (match) {
        // ZIPの場合、拡張子でOffice文書かどうか判定
        if (mime === 'application/zip') {
          const ext = filename.split('.').pop()?.toLowerCase();
          if (ext && OFFICE_EXTENSIONS[ext]) {
            return OFFICE_EXTENSIONS[ext];
          }
        }
        return mime;
      }
    }
  }

  return null;
}

/**
 * MIMEタイプを検証・修正
 * クライアント提供のMIMEタイプとマジックバイトを比較し、
 * 信頼できるMIMEタイプを返す
 */
export function validateMimeType(
  buffer: ArrayBuffer,
  filename: string,
  claimedMime: string
): { mime: string; validated: boolean } {
  const detectedMime = detectMimeType(buffer, filename);

  // マジックバイトで検出できた場合、検出結果を優先
  if (detectedMime) {
    return {
      mime: detectedMime,
      validated: true,
    };
  }

  // 検出できない場合、拡張子から推測
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext) {
    const guessedMime = guessMimeTypeFromExtension(ext);
    if (guessedMime) {
      return {
        mime: guessedMime,
        validated: false, // マジックバイトでは未検証
      };
    }
  }

  // フォールバック: テキスト系はそのまま、それ以外はoctet-stream
  if (claimedMime.startsWith('text/')) {
    return { mime: claimedMime, validated: false };
  }

  return { mime: 'application/octet-stream', validated: false };
}

/**
 * 拡張子からMIMEタイプを推測
 */
function guessMimeTypeFromExtension(ext: string): string | null {
  const mimeTypes: Record<string, string> = {
    // ドキュメント
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    rtf: 'application/rtf',
    // 画像
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    // 圧縮ファイル
    zip: 'application/zip',
    gz: 'application/gzip',
    tar: 'application/x-tar',
    rar: 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    // その他
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    ts: 'text/typescript',
    md: 'text/markdown',
  };

  return mimeTypes[ext] || null;
}
