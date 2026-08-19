/**
 * スキーマ初期化サービス
 *
 * migrations/ のSQLをバンドルに取り込み、Worker実行時に適用する。
 * デプロイコマンドに `wrangler d1 migrations apply` を含めなくても
 * スキーマが用意されるため、Deploy to Cloudflareボタン経由の
 * デプロイだけでアプリが動作する。
 *
 * すべての文は繰り返し実行しても安全な形にしている
 * （CREATE ... IF NOT EXISTS、および重複カラムのALTERは無視）。
 */

import migration0001 from '../../migrations/0001_initial.sql';
import migration0002 from '../../migrations/0002_receive_links.sql';
import migration0003 from '../../migrations/0003_rate_limits.sql';
import migration0004 from '../../migrations/0004_local_auth.sql';

/** 適用順に並べたマイグレーション */
const MIGRATIONS: { name: string; sql: string }[] = [
  { name: '0001_initial', sql: migration0001 },
  { name: '0002_receive_links', sql: migration0002 },
  { name: '0003_rate_limits', sql: migration0003 },
  { name: '0004_local_auth', sql: migration0004 },
];

/**
 * 同一アイソレート内で初期化済みかを保持する
 * リクエストごとにDDLを流さないためのキャッシュ
 */
let schemaReady = false;

/**
 * SQLファイルを実行可能な文の配列に分解
 * 行コメント（--）を除去し、セミコロンで分割する
 */
function splitStatements(sql: string): string[] {
  return sql
    .split('\n')
    .map((line) => {
      const commentIndex = line.indexOf('--');
      return commentIndex >= 0 ? line.slice(0, commentIndex) : line;
    })
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

/**
 * 繰り返し実行しても問題ないエラーかを判定
 * ALTER TABLE ADD COLUMN は IF NOT EXISTS を書けないため、
 * 既にカラムが存在する場合のエラーは正常として扱う
 */
function isIgnorableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('duplicate column name') ||
    message.includes('already exists')
  );
}

/**
 * スキーマを適用（未適用の場合のみ）
 */
export async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaReady) {
    return;
  }

  for (const migration of MIGRATIONS) {
    for (const statement of splitStatements(migration.sql)) {
      try {
        await db.prepare(statement).run();
      } catch (error) {
        if (isIgnorableError(error)) {
          continue;
        }
        throw new Error(
          `マイグレーション ${migration.name} の適用に失敗しました: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  }

  schemaReady = true;
}
