# FileWing - セキュアファイル共有

脱PPAP対応のセキュアなファイル共有システム。Cloudflare Workers + R2 + D1 でサーバーレス構築。

## 特徴

- **セキュアなファイル共有**: パスワード保護、有効期限付きリンク、ダウンロード回数制限
- **ファイルサイズ無制限**: R2ストレージによる大容量ファイル対応
- **ファイル受信機能**: ゲストからファイルを受け取るリンクを発行
- **ダウンロード追跡**: IP、日時、ユーザーエージェントを記録
- **CSVエクスポート**: 送受信履歴をCSV形式でエクスポート
- **多言語対応**: 日本語/英語切り替え
- **メール通知**: ダウンロードリンクをメールで送信（Cloudflare Email Sending）
- **自動クリーンアップ**: 期限切れファイルをR2から自動削除
- **コスト見積もり**: Cloudflareサービス使用量・予想コストを表示
- **サーバーレス**: Cloudflare Workersで高速・低コスト運用
- **認証連携**: Cloudflare Access（Google/Microsoft/SAML対応）

## 画面構成

| 画面 | パス | 説明 |
|-----|------|------|
| ダッシュボード | `/` | 統計・アクティビティ・コストサマリー |
| アップロード | `/upload` | ファイル送信・リンク作成 |
| ファイル管理 | `/files` | ファイル一覧・詳細 |
| 受信管理 | `/receive` | 受信リンク一覧・受信ファイル |
| コスト見積もり | `/costs` | Cloudflareサービス使用量・予想コスト |
| ダウンロード | `/d/:token` | 公開ダウンロードページ |
| ゲスト送信 | `/r/:token` | ゲストアップロードページ |

## クイックスタート

### 前提条件

- Node.js 18以上
- Cloudflareアカウント
- wrangler CLI

### ローカル開発

```bash
# 依存関係インストール
npm install

# wrangler.local.tomlを作成（下記「本番デプロイ」セクション参照）
# account_id と database_id を設定

# ローカルDBマイグレーション
wrangler d1 migrations apply filewing-db --local -c wrangler.local.toml

# 開発サーバー起動
wrangler dev -c wrangler.local.toml
```

http://localhost:8787 でアクセス。開発環境では認証がスキップされ、テストユーザーとして自動ログインします。

### 本番デプロイ

#### 1. Cloudflareリソース作成

```bash
# D1データベース作成
wrangler d1 create filewing-db

# R2バケット作成
wrangler r2 bucket create filewing-bucket
```

#### 2. ローカル設定ファイル作成

`wrangler.local.toml` を作成し、実際のIDを設定（このファイルはgitignored）:

```toml
name = "filewing"
main = "src/index.ts"
compatibility_date = "2024-04-01"
compatibility_flags = ["nodejs_compat"]
account_id = "your-account-id"

[vars]
SKIP_AUTH = "true"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "filewing-bucket"

[[d1_databases]]
binding = "DB"
database_name = "filewing-db"
database_id = "your-database-id"
migrations_dir = "migrations"

[[send_email]]
name = "EMAIL"

[triggers]
crons = ["0 18 * * *"]

[env.production]
vars = { SKIP_AUTH = "false" }

[[env.production.r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "filewing-bucket"

[[env.production.d1_databases]]
binding = "DB"
database_name = "filewing-db"
database_id = "your-database-id"

[[env.production.send_email]]
name = "EMAIL"
```

開発時は `wrangler dev -c wrangler.local.toml` で起動します。

#### 3. Email Routing設定

Cloudflareダッシュボードで:
1. Email → Email Routing を有効化
2. 送信元ドメインを検証

#### 4. DBマイグレーション

```bash
wrangler d1 migrations apply filewing-db -c wrangler.local.toml --env production --remote
```

#### 5. デプロイ

```bash
wrangler deploy -c wrangler.local.toml --env production
```

#### 6. Cloudflare Access設定

Cloudflareダッシュボードで:
1. Zero Trust → Access → Applications
2. Self-hostedアプリケーションを追加
3. 認証ポリシーを設定（Google/Microsoft/SAML等）

## 使い方

### ファイルを送信

1. `/upload` にアクセス
2. ファイルをドラッグ&ドロップ（または選択）
3. 有効期限・パスワード・ダウンロード回数制限を設定
4. 送信先メールアドレスを入力（オプション）
5. 「アップロード」をクリック
6. ダウンロードリンクが生成される

### ファイルを受信

1. `/receive` にアクセス
2. 「受信リンクを作成」をクリック
3. タイトル・有効期限・パスワードを設定
4. 生成されたリンクをゲストに共有
5. ゲストがファイルをアップロード
6. 受信ファイル一覧からダウンロード

### ダウンロード状況を確認

`/files/{id}` でファイル詳細画面を開くと:
- 各リンクのダウンロード回数
- ダウンロード元IP・日時
- 送信先メールアドレス一覧

### CSVエクスポート

管理画面から以下をエクスポート可能:
- ファイル一覧
- ダウンロード履歴
- 受信ファイル履歴

### 言語切り替え

ヘッダー右上の言語リンクをクリック、または:
- `?lang=ja` - 日本語
- `?lang=en` - 英語

## API仕様

### 認証が必要なエンドポイント

#### ファイル管理
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/files` | ファイルアップロード |
| GET | `/api/files` | ファイル一覧 |
| GET | `/api/files/:id` | ファイル詳細 |
| DELETE | `/api/files/:id` | ファイル削除 |

#### リンク管理
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/files/:id/links` | リンク作成 |
| DELETE | `/api/links/:id` | リンク無効化 |
| GET | `/api/links/:id/stats` | ダウンロード統計 |
| POST | `/api/links/:id/send` | メール送信 |

#### 受信リンク管理
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/receive-links` | 受信リンク作成 |
| GET | `/api/receive-links` | 受信リンク一覧 |
| GET | `/api/receive-links/:id` | 受信リンク詳細 |
| DELETE | `/api/receive-links/:id` | 受信リンク無効化 |
| DELETE | `/api/receive-links/:id/full` | 受信リンク完全削除 |
| GET | `/api/received-files/:id/download` | 受信ファイルダウンロード |
| DELETE | `/api/received-files/:id` | 受信ファイル削除 |

#### CSVエクスポート
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/export/files` | ファイル一覧CSV |
| GET | `/api/export/downloads` | ダウンロード履歴CSV |
| GET | `/api/export/received` | 受信ファイル履歴CSV |

### 公開エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/d/:token` | ダウンロードページ |
| GET | `/d/:token/download` | ファイルダウンロード |
| GET | `/r/:token` | ゲストアップロードページ |
| POST | `/r/:token/upload` | ゲストファイルアップロード |

## プロジェクト構造

```
FileWing/
├── src/
│   ├── index.ts              # エントリーポイント
│   ├── scheduled.ts          # 定期クリーンアップ
│   ├── types/                # 型定義
│   ├── middleware/           # 認証・言語ミドルウェア
│   ├── i18n/                 # 多言語対応
│   ├── services/             # R2/D1/Email/コスト計算/レート制限
│   ├── utils/                # 暗号化・MIME検証ユーティリティ
│   ├── routes/
│   │   ├── api/              # REST API
│   │   └── pages/            # HTMLページ
│   └── templates/            # UIテンプレート
├── migrations/               # D1マイグレーション
├── wrangler.toml             # Cloudflare Workers設定（テンプレート）
├── wrangler.local.toml       # ローカル設定（gitignored、実際のIDを記載）
├── .gitignore
├── package.json
├── tsconfig.json
├── CLAUDE.md                 # Claude Code用ガイダンス
└── README.md
```

## セキュリティ

- **認証**: Cloudflare AccessによるJWT検証
- **トークン**: 64文字の暗号学的に安全なランダム文字列
- **有効期限**: サーバーサイドで厳密チェック（1-10日）
- **ダウンロード回数制限**: 上限到達で自動無効化・ファイル削除
- **R2アクセス**: Workers経由のみ（直接アクセス禁止）
- **SQLi対策**: プリペアドステートメント使用
- **ファイル名**: サニタイズ処理でパストラバーサル防止
- **パスワード保護**: PBKDF2ハッシュ化（100,000イテレーション）
- **ブルートフォース対策**: レート制限（5回失敗で30分ロックアウト）
- **MIME検証**: マジックバイトによるファイル種別検証
- **XSS対策**: JavaScript文字列エスケープ処理

## R2ストレージ管理

### 自動クリーンアップ

以下のタイミングでR2からファイルを自動削除:
- **ダウンロード回数制限到達時**: 最後のダウンロード完了後に即削除
- **定期クリーンアップ**: 毎日3:00 JST（Cron Trigger）に期限切れファイルを一括削除

### 手動削除

管理画面（`/files`）から個別にファイルを削除可能。

## 技術スタック

- **ランタイム**: Cloudflare Workers
- **フレームワーク**: [Hono](https://hono.dev/) v4
- **ストレージ**: Cloudflare R2（容量無制限）
- **データベース**: Cloudflare D1
- **認証**: Cloudflare Access
- **メール**: Cloudflare Email Sending
- **UI**: Tailwind CSS

## ライセンス

MIT
