/**
 * 定期クリーンアップジョブ
 * Cron Triggerで実行され、不要なファイルをR2から削除
 */

import type { Env } from './types';
import {
  getFilesToCleanup,
  markFileDeleted,
  getReceivedFilesToCleanup,
  deleteReceivedFile,
} from './services/d1';
import { deleteFile } from './services/r2';

/**
 * 定期クリーンアップ処理
 * - 有効なリンクがないファイルをR2から削除
 * - ダウンロード済みの受信ファイルを削除
 */
export async function handleScheduled(
  env: Env,
  _ctx: ExecutionContext
): Promise<void> {
  console.log('クリーンアップジョブ開始');

  let deletedFiles = 0;
  let deletedReceivedFiles = 0;

  try {
    // 送信ファイルのクリーンアップ
    const filesToCleanup = await getFilesToCleanup(env.DB);
    console.log(`削除対象ファイル: ${filesToCleanup.length}件`);

    for (const file of filesToCleanup) {
      try {
        await deleteFile(env.R2_BUCKET, file.r2_key);
        await markFileDeleted(env.DB, file.id);
        deletedFiles++;
        console.log(`削除: ${file.r2_key}`);
      } catch (error) {
        console.error(`ファイル削除エラー (${file.id}):`, error);
      }
    }

    // 受信ファイルのクリーンアップ
    const receivedFilesToCleanup = await getReceivedFilesToCleanup(env.DB);
    console.log(`削除対象受信ファイル: ${receivedFilesToCleanup.length}件`);

    for (const file of receivedFilesToCleanup) {
      try {
        await deleteFile(env.R2_BUCKET, file.r2_key);
        await deleteReceivedFile(env.DB, file.id);
        deletedReceivedFiles++;
        console.log(`受信ファイル削除: ${file.r2_key}`);
      } catch (error) {
        console.error(`受信ファイル削除エラー (${file.id}):`, error);
      }
    }

    console.log(
      `クリーンアップ完了: 送信ファイル ${deletedFiles}件, 受信ファイル ${deletedReceivedFiles}件 削除`
    );
  } catch (error) {
    console.error('クリーンアップエラー:', error);
  }
}
