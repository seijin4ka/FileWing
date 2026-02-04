# CLAUDE.md

このファイルはClaude Codeがこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

法人向けファイルアップローダー（脱PPAP対応）。Cloudflare Workers + Hono + R2 + D1 でサーバーレス構築。

## 技術スタック

- **ランタイム**: Cloudflare Workers
- **フレームワーク**: Hono v4
- **ストレージ**: Cloudflare R2
- **データベース**: Cloudflare D1 (SQLite)
- **認証**: Cloudflare Access (JWT)
- **メール**: Resend API
- **UI**: Tailwind CSS (CDN)

## 開発コマンド

```bash
# 依存関係インストール
npm install

# ローカルDBマイグレーション
npm run db:migrate

# 開発サーバー起動（http://localhost:8787）
npm run dev

# 型チェック
npm run typecheck

# 本番デプロイ
npm run deploy
```

## プロジェクト構造

```
src/
├── index.ts              # エントリーポイント、ルーティング設定
├── types/index.ts        # 型定義（Env, Models, API types）
├── middleware/auth.ts    # Cloudflare Access認証
├── services/
│   ├── r2.ts            # R2ストレージ操作
│   ├── d1.ts            # D1データベース操作
│   └── email.ts         # Resendメール送信
├── routes/
│   ├── api/             # REST API
│   │   ├── files.ts     # POST/GET/DELETE /api/files
│   │   ├── links.ts     # POST /api/files/:id/links, DELETE /api/links/:id
│   │   └── email.ts     # POST /api/links/:id/send
│   └── pages/           # HTMLページ（SSR）
│       ├── dashboard.ts # GET /
│       ├── upload.ts    # GET /upload
│       ├── files.ts     # GET /files, GET /files/:id
│       └── download.ts  # GET /d/:token（公開）
└── templates/
    ├── layout.ts        # 共通HTMLレイアウト
    └── components/      # UIコンポーネント
```

## 重要なアーキテクチャ決定

### 認証
- 本番: Cloudflare Access JWT検証
- 開発: `SKIP_AUTH=true` でテストユーザー自動ログイン

### ファイル保存
- R2キー形式: `{userId}/{timestamp}-{uuid}/{sanitizedFilename}`
- 論理削除（`deleted_at`）を使用、R2からの物理削除はオプション

### ダウンロードリンク
- トークン: 64文字の暗号学的に安全なランダム文字列
- 有効期限: 1-10日（サーバーサイドで厳密チェック）
- オプション: パスワード保護、最大ダウンロード回数

### UIレンダリング
- サーバーサイドHTML生成（テンプレート文字列）
- Tailwind CSS（CDN経由）
- クライアントサイドJavaScriptは最小限（フォーム処理、通知）

## データベーススキーマ

5つのテーブル:
1. `users` - Cloudflare Accessユーザー
2. `files` - アップロードファイルメタデータ
3. `download_links` - ダウンロードリンク（トークン、期限、パスワード）
4. `link_recipients` - メール送信先記録
5. `download_logs` - ダウンロード履歴（IP、UA、日時）

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
- **コミットメッセージにClaude/Co-Authored-Byの署名は記載しない**
- 機能の修正や追加毎に頻繁にコミットする
- コミット前にこのルールが適用されているか必ず確認する

## ローカルデータ保存場所

開発時のデータは `.wrangler/state/v3/` に保存:
- `d1/` - D1データベース（SQLite）
- `r2/` - R2ファイル（blobストレージ）

## 環境変数・シークレット

| 変数名 | 説明 | 設定方法 |
|-------|------|---------|
| `SKIP_AUTH` | 認証スキップ（開発用） | wrangler.toml |
| `RESEND_API_KEY` | Resend APIキー | `wrangler secret put` |
| `ACCESS_TEAM_NAME` | Cloudflare Accessチーム名 | wrangler.toml |
| `ACCESS_AUD` | Cloudflare Access AUD | wrangler.toml |
