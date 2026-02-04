# 法人向けファイルアップローダー

脱PPAP対応のセキュアなファイル共有システム。Cloudflare Workers + R2 + D1 でサーバーレス構築。

## 特徴

- **セキュアなファイル共有**: パスワード保護、有効期限付きリンク、ダウンロード回数制限
- **ファイル受信機能**: ゲストからファイルを受け取るリンクを発行
- **ダウンロード追跡**: IP、日時、ユーザーエージェントを記録
- **CSVエクスポート**: 送受信履歴をCSV形式でエクスポート
- **多言語対応**: 日本語/英語切り替え
- **メール通知**: ダウンロードリンクをメールで送信（Resend API）
- **自動クリーンアップ**: 期限切れファイルをR2から自動削除
- **サーバーレス**: Cloudflare Workersで高速・低コスト運用
- **認証連携**: Cloudflare Access（Google/Microsoft/SAML対応）

## 画面構成

| 画面 | パス | 説明 |
|-----|------|------|
| ダッシュボード | `/` | 統計・アクティビティ表示 |
| アップロード | `/upload` | ファイル送信・リンク作成 |
| ファイル管理 | `/files` | ファイル一覧・詳細 |
| 受信管理 | `/receive` | 受信リンク一覧・受信ファイル |
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
| GET | `/api/received-files/:id/download` | 受信ファイルダウンロード |

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
cloudflare-worker-uploader/
├── src/
│   ├── index.ts              # エントリーポイント
│   ├── scheduled.ts          # 定期クリーンアップ
│   ├── types/                # 型定義
│   ├── middleware/           # 認証・言語ミドルウェア
│   ├── i18n/                 # 多言語対応
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
- **ダウンロード回数制限**: 上限到達で自動無効化・ファイル削除
- **R2アクセス**: Workers経由のみ（直接アクセス禁止）
- **SQLi対策**: プリペアドステートメント使用
- **ファイル名**: サニタイズ処理でパストラバーサル防止

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
- **ストレージ**: Cloudflare R2
- **データベース**: Cloudflare D1
- **認証**: Cloudflare Access
- **メール**: [Resend](https://resend.com/)
- **UI**: Tailwind CSS

## ライセンス

MIT
