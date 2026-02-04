# CLAUDE.md

このファイルはClaude Codeがこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

**FileWing** - 脱PPAP対応のセキュアなファイル共有システム。Cloudflare Workers + Hono + R2 + D1 でサーバーレス構築。

## 技術スタック

- **ランタイム**: Cloudflare Workers
- **フレームワーク**: Hono v4
- **ストレージ**: Cloudflare R2（容量無制限）
- **データベース**: Cloudflare D1 (SQLite)
- **認証**: Cloudflare Access (JWT)
- **メール**: Cloudflare Email Sending
- **UI**: Tailwind CSS (CDN)
- **多言語対応**: 日本語/英語

## 開発コマンド

```bash
# 依存関係インストール
npm install

# ローカルDBマイグレーション（wrangler.local.toml使用時）
wrangler d1 migrations apply filewing-db --local -c wrangler.local.toml

# 開発サーバー起動（http://localhost:8787）
wrangler dev -c wrangler.local.toml

# 型チェック
npm run typecheck

# 本番デプロイ
wrangler deploy -c wrangler.local.toml --env production
```

※ `npm run dev` / `npm run deploy` は wrangler.toml（テンプレート）を使用するため、
  実際の開発・デプロイには `-c wrangler.local.toml` オプションを付けて直接実行してください。

## プロジェクト構造

```
src/
├── index.ts              # エントリーポイント、ルーティング設定
├── scheduled.ts          # 定期クリーンアップジョブ（Cron Trigger）
├── types/index.ts        # 型定義（Env, Models, API types）
├── middleware/
│   ├── auth.ts           # Cloudflare Access認証
│   └── language.ts       # 言語検出ミドルウェア
├── i18n/
│   ├── index.ts          # 多言語ユーティリティ
│   └── translations.ts   # 日本語/英語翻訳定義
├── services/
│   ├── r2.ts             # R2ストレージ操作
│   ├── d1.ts             # D1データベース操作
│   ├── email.ts          # Cloudflare Email Sending
│   ├── costs.ts          # コスト見積もり計算
│   └── ratelimit.ts      # レート制限（ブルートフォース対策）
├── utils/
│   ├── crypto.ts         # PBKDF2パスワードハッシュ化、タイミング安全比較
│   └── mime.ts           # マジックバイトによるMIME検証
├── routes/
│   ├── api/
│   │   ├── files.ts      # POST/GET/DELETE /api/files
│   │   ├── links.ts      # POST /api/files/:id/links, DELETE /api/links/:id
│   │   ├── email.ts      # POST /api/links/:id/send
│   │   ├── receive.ts    # 受信リンク管理API
│   │   └── export.ts     # CSVエクスポートAPI
│   └── pages/
│       ├── dashboard.ts  # GET /
│       ├── upload.ts     # GET /upload
│       ├── files.ts      # GET /files, GET /files/:id
│       ├── download.ts   # GET /d/:token（公開）
│       ├── receive.ts    # GET /receive（受信リンク管理）
│       ├── receive-guest.ts  # GET /r/:token（ゲストアップロード・公開）
│       └── costs.ts      # GET /costs（コスト見積もりダッシュボード）
└── templates/
    ├── layout.ts         # 共通HTMLレイアウト
    └── components/       # UIコンポーネント
```

## 主要機能

### 送信機能
- ファイルアップロード（ドラッグ&ドロップ対応、**ファイルサイズ無制限**）
- ダウンロードリンク生成（有効期限1-10日）
- オプション: パスワード保護、ダウンロード回数制限
- メール通知（Cloudflare Email Sending）

### 受信機能
- 受信リンク発行（ゲストからファイルを受け取る）
- オプション: パスワード保護、最大ファイル数制限
- 受信ファイル一覧・ダウンロード・個別削除
- 受信リンクの完全削除（ファイルも一括削除）

### CSVエクスポート
- ファイル一覧エクスポート (`/api/export/files`)
- ダウンロード履歴エクスポート (`/api/export/downloads`)
- 受信ファイル履歴エクスポート (`/api/export/received`)

### 言語切り替え
- 日本語/英語対応
- Cookie・クエリパラメータ・Accept-Languageヘッダーで自動検出
- `?lang=en` または `?lang=ja` で切り替え

### R2自動クリーンアップ
- ダウンロード回数制限到達時: 即座にR2から削除
- 定期クリーンアップ: Cron Trigger（毎日3:00 JST）で期限切れファイルを一括削除

## 重要なアーキテクチャ決定

### 認証
- 本番: Cloudflare Access JWT検証
- 開発: `SKIP_AUTH=true` でテストユーザー自動ログイン

### ファイル保存
- R2キー形式: `{userId}/{timestamp}-{uuid}/{sanitizedFilename}`
- 論理削除（`deleted_at`）を使用
- 有効リンクがなくなったファイルは自動削除

### ダウンロードリンク
- トークン: 64文字の暗号学的に安全なランダム文字列
- 有効期限: 1-10日（サーバーサイドで厳密チェック）
- オプション: パスワード保護、最大ダウンロード回数
- 回数制限到達時は自動無効化

### セキュリティ対策
- **パスワードハッシュ**: PBKDF2（SHA-256、100,000イテレーション、ソルト付き）
- **タイミング攻撃対策**: 定数時間文字列比較
- **レート制限**: 5回失敗で30分ロックアウト（D1でトラッキング）
- **MIME検証**: マジックバイトによるファイル種別検証（拡張子偽装対策）
- **XSS対策**: JavaScript文字列のエスケープ処理

### コスト見積もり
- Cloudflare R2/D1/Workers の2026年料金体系に基づく計算
- 無料枠の考慮（R2: 10GB、D1: 5GB、Workers: 1000万リクエスト/月）
- ダッシュボードとコスト専用ページで表示

### UIレンダリング
- サーバーサイドHTML生成（テンプレート文字列）
- Tailwind CSS（CDN経由）
- クライアントサイドJavaScriptは最小限（フォーム処理、通知）

## データベーススキーマ

8つのテーブル:
1. `users` - Cloudflare Accessユーザー
2. `files` - アップロードファイルメタデータ
3. `download_links` - ダウンロードリンク（トークン、期限、パスワード、回数制限）
4. `link_recipients` - メール送信先記録
5. `download_logs` - ダウンロード履歴（IP、UA、日時）
6. `receive_links` - 受信リンク（ゲストアップロード用）
7. `received_files` - 受信ファイル
8. `password_attempts` - パスワード試行記録（レート制限用）

マイグレーションは `migrations/` ディレクトリに配置。

## コーディング規約

- コメント・ドキュメントは日本語
- TypeScript strict mode
- Honoのコンテキストに `Env` と `Variables` を型付け
- エラーは日本語メッセージで返す
- SQLはプリペアドステートメント使用（SQLi防止）

## Gitコミットルール

**重要: 以下のルールは永続的に適用されます**

- コミットメッセージに修正内容・開発内容を詳細に記載する
- **コミットメッセージ・ドキュメントに他社製品名を記載しない**
  - Cloudflare製品名（Workers, R2, D1, Access等）は記載OK
- 機能の修正や追加毎に頻繁にコミットする
- コミット前にこのルールが適用されているか必ず確認する

## GitHubリポジトリ

- リポジトリ: `seijin4ka/FileWing`
- Issues/PRは `gh` コマンドで管理

## ローカルデータ保存場所

開発時のデータは `.wrangler/state/v3/` に保存:
- `d1/` - D1データベース（SQLite）
- `r2/` - R2ファイル（blobストレージ）

## 環境変数・シークレット

| 変数名 | 説明 | 設定方法 |
|-------|------|---------|
| `SKIP_AUTH` | 認証スキップ（開発用） | wrangler.toml |
| `ACCESS_TEAM_NAME` | Cloudflare Accessチーム名 | wrangler.toml |
| `ACCESS_AUD` | Cloudflare Access AUD | wrangler.toml |

## wrangler設定ファイル

- **wrangler.toml**: テンプレート（機密情報なし、gitにコミット）
- **wrangler.local.toml**: 実際のaccount_id/database_id（gitignored）

開発時は `wrangler dev -c wrangler.local.toml` で起動。
本番デプロイは `wrangler deploy -c wrangler.local.toml --env production`。

## Email Sending設定

Cloudflare Email Routing を使用:
1. Cloudflareダッシュボードで Email Routing を有効化
2. 送信元ドメインを検証
3. wrangler.toml に `[[send_email]]` バインディングを設定

## Cron Trigger設定

```toml
# wrangler.toml
[triggers]
crons = ["0 18 * * *"]  # 毎日18:00 UTC = 3:00 JST
```

定期クリーンアップで以下を実行:
- 有効リンクがないファイルをR2から削除
- ダウンロード済みの受信ファイルを削除（リンク期限切れ後）
