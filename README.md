# 法人向けファイルアップローダー

脱PPAP対応のセキュアなファイル共有システム。Cloudflare Workers + R2 + D1 でサーバーレス構築。

## 特徴

- **セキュアなファイル共有**: パスワード保護、有効期限付きリンク
- **ダウンロード追跡**: IP、日時、ユーザーエージェントを記録
- **メール通知**: ダウンロードリンクをメールで送信（Resend API）
- **サーバーレス**: Cloudflare Workersで高速・低コスト運用
- **認証連携**: Cloudflare Access（Google/Microsoft/SAML対応）

## 画面イメージ

| ダッシュボード | アップロード | ダウンロード |
|--------------|-------------|-------------|
| 統計・アクティビティ表示 | ドラッグ&ドロップ対応 | パスワード入力対応 |

## クイックスタート

### 前提条件

- Node.js 18以上
- Cloudflareアカウント
- wrangler CLI

### ローカル開発

```bash
# 依存関係インストール
npm install

# ローカルDBマイグレーション
npm run db:migrate

# 開発サーバー起動
npm run dev
```

http://localhost:8787 でアクセス。開発環境では認証がスキップされ、テストユーザーとして自動ログインします。

### 本番デプロイ

#### 1. Cloudflareリソース作成

```bash
# D1データベース作成
wrangler d1 create file-uploader-db

# R2バケット作成
wrangler r2 bucket create file-uploader-bucket
```

#### 2. wrangler.toml更新

```toml
[[d1_databases]]
database_id = "実際のデータベースID"
```

#### 3. シークレット設定

```bash
# Resend APIキー（メール送信用）
wrangler secret put RESEND_API_KEY
```

#### 4. DBマイグレーション

```bash
npm run db:migrate:prod
```

#### 5. デプロイ

```bash
npm run deploy
```

#### 6. Cloudflare Access設定

Cloudflareダッシュボードで:
1. Zero Trust → Access → Applications
2. Self-hostedアプリケーションを追加
3. 認証ポリシーを設定（Google/Microsoft/SAML等）

## 使い方

### ファイルをアップロード

1. `/upload` にアクセス
2. ファイルをドラッグ&ドロップ（または選択）
3. 有効期限・パスワード・送信先を設定
4. 「アップロード」をクリック
5. ダウンロードリンクが生成される

### ファイルを共有

- **リンクをコピー**: 相手に直接URLを送信
- **メールで送信**: 送信先を入力すると自動でメール通知

### ダウンロード状況を確認

`/files/{id}` でファイル詳細画面を開くと:
- 各リンクのダウンロード回数
- ダウンロード元IP・日時
- 送信先メールアドレス一覧

## API仕様

### 認証が必要なエンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/files` | ファイルアップロード |
| GET | `/api/files` | ファイル一覧 |
| GET | `/api/files/:id` | ファイル詳細 |
| DELETE | `/api/files/:id` | ファイル削除 |
| POST | `/api/files/:id/links` | リンク作成 |
| DELETE | `/api/links/:id` | リンク無効化 |
| GET | `/api/links/:id/stats` | ダウンロード統計 |
| POST | `/api/links/:id/send` | メール送信 |

### 公開エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/d/:token` | ダウンロードページ |
| GET | `/d/:token/download` | ファイルダウンロード |

## プロジェクト構造

```
cloudflare-worker-uploader/
├── src/
│   ├── index.ts              # エントリーポイント
│   ├── types/                # 型定義
│   ├── middleware/           # 認証ミドルウェア
│   ├── services/             # R2/D1/Email操作
│   ├── routes/
│   │   ├── api/              # REST API
│   │   └── pages/            # HTMLページ
│   └── templates/            # UIテンプレート
├── migrations/               # D1マイグレーション
├── wrangler.toml             # Cloudflare Workers設定
└── package.json
```

## セキュリティ

- **認証**: Cloudflare AccessによるJWT検証
- **トークン**: 64文字の暗号学的に安全なランダム文字列
- **有効期限**: サーバーサイドで厳密チェック（1-10日）
- **R2アクセス**: Workers経由のみ（直接アクセス禁止）
- **SQLi対策**: プリペアドステートメント使用
- **ファイル名**: サニタイズ処理でパストラバーサル防止

## 技術スタック

- **ランタイム**: Cloudflare Workers
- **フレームワーク**: [Hono](https://hono.dev/) v4
- **ストレージ**: Cloudflare R2
- **データベース**: Cloudflare D1
- **認証**: Cloudflare Access
- **メール**: [Resend](https://resend.com/)
- **UI**: Tailwind CSS

## ライセンス

MIT
