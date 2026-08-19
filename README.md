# FileWing - セキュアファイル共有

脱PPAP対応のセキュアなファイル共有システム。Cloudflare Workers + R2 + D1 でサーバーレス構築。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/seijin4ka/FileWing)

ボタンを押すとリポジトリのコピー作成からD1・R2の作成、デプロイまで自動で行われます。
詳細は[クイックスタート](#クイックスタート)を参照してください。

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
- **認証連携**: SAML SSO（Google Workspace等）またはCloudflare Access

## 画面構成

| 画面 | パス | 説明 |
|-----|------|------|
| ダッシュボード | `/` | 統計・アクティビティ・コストサマリー |
| アップロード | `/upload` | ファイル送信・リンク作成 |
| ファイル管理 | `/files` | ファイル一覧・詳細 |
| リンク管理 | `/links` | ダウンロードリンク一覧・統計 |
| 受信管理 | `/receive` | 受信リンク一覧・受信ファイル |
| コスト見積もり | `/costs` | Cloudflareサービス使用量・予想コスト |
| ダウンロード | `/d/:token` | 公開ダウンロードページ |
| ゲスト送信 | `/r/:token` | ゲストアップロードページ |
| ログイン | `/login` | ログインページ（SAML認証時） |

## 認証方式

FileWingは2つの認証方式をサポートしています。`AUTH_METHOD`環境変数で切り替え可能です。

| AUTH_METHOD | 説明 | ログアウト | 推奨用途 |
|-------------|------|-----------|---------|
| `saml` | SAML 2.0 SSO認証 | アプリ内で可能 | 社外取引先にダウンロードリンクを共有する場合 |
| `cloudflare-access` | Cloudflare Access認証 | Cloudflare側で管理 | 社内限定利用の場合 |
| `skip` | 認証スキップ | - | 開発環境用 |

> **ポイント**: Cloudflare Accessを使用すると、ダウンロードリンク（`/d/:token`）もAccess認証が必要になります。社外の取引先にファイルを共有する場合は、SAML認証を使用してください。

### SAML認証の特徴

- 管理画面のみ認証が必要（ダウンロードリンク・受信リンクは認証不要）
- Google Workspace、Microsoft Azure AD、Okta等のIdPに対応
- ドメイン制限で許可されたドメインのユーザーのみログイン可能
- セッション有効期限（デフォルト1日）でセキュリティ確保

## クイックスタート

### ワンクリックデプロイ（推奨）

ページ冒頭の **Deploy to Cloudflare** ボタンからデプロイすると、以下が自動的に実行されます。

1. リポジトリのコピーを自分のGitHub/GitLabアカウントに作成
2. D1データベースとR2バケットを自動作成（IDの調査・記入は不要）
3. `npm run deploy` によるデプロイとDBマイグレーション

**デプロイ直後の状態について**

`wrangler.toml` は `AUTH_METHOD = "saml"` を既定値としています。
シークレット未設定の状態ではすべてのページアクセスがログインページに
リダイレクトされ、APIは401を返します（フェイルクローズ）。
そのためアプリが認証なしで公開されることはありません。
下記「認証設定」を完了すると利用可能になります。

### 前提条件（CLIで操作する場合）

- Node.js 18以上
- Cloudflareアカウント

### ローカル開発

```bash
# 依存関係インストール
npm install

# ローカルDBマイグレーション
npm run db:migrate

# 開発サーバー起動
npm run dev
```

http://localhost:8787 でアクセス。ローカルのD1・R2は初回起動時に自動作成されます。

`npm run dev` は `--var AUTH_METHOD:skip` を付けて起動するため、
認証がスキップされテストユーザーとして自動ログインします。
この上書きはローカル実行時のみで、`wrangler.toml` には保存されません。

### 本番デプロイ（CLI）

```bash
# Cloudflareにログイン
npx wrangler login

# デプロイ（D1・R2の作成 → デプロイ → マイグレーション）
npm run deploy
```

`npm run deploy` は以下を順に実行します。

1. `wrangler deploy`
   初回実行時にD1データベースとR2バケットを自動作成してバインディングに紐付けます
2. `wrangler d1 migrations apply DB --remote`
   作成されたD1にマイグレーションを適用します（データベース名ではなく
   バインディング名 `DB` を指定するため、DB名を変更しても動作します）

リソースIDは `wrangler.toml` に記載していません。ID省略時は
Cloudflareが自動でリソースを作成するため、公開リポジトリにIDを載せずに済みます。
（この自動プロビジョニングには wrangler 4.45.0 以上が必要です）

> **Workers Builds（GitHub連携）を使う場合**
> デプロイコマンドを `npm run deploy` に設定してください。
> `npx wrangler deploy` のままだとマイグレーションが実行されず、
> D1にテーブルが無いため全ページが500エラーになります。

#### デプロイ後の設定

`wrangler.toml` の `[vars]` を実際の値に置き換えてください。

| 変数 | 説明 |
|------|------|
| `EMAIL_FROM` | Email Routingで検証済みの送信元アドレス |
| `APP_URL` | 実際のデプロイ先URL（ログアウト後のリダイレクト先） |
| `SAML_*` | IdPから取得した値 |

シークレットはコマンドで設定します（`.dev.vars.example` を参照）。

```bash
wrangler secret put SESSION_SECRET
wrangler secret put SAML_IDP_CERT
```

#### Email Routing設定

Cloudflareダッシュボードで:
1. Email → Email Routing を有効化
2. 送信元ドメインを検証

### 認証設定

##### オプションA: SAML SSO認証（推奨）

社外取引先にダウンロードリンクを共有する場合はSAML認証を使用します。

**Google Workspace SAML設定手順:**

1. Google Admin Console (admin.google.com) にログイン
2. アプリ → ウェブアプリとモバイルアプリ → アプリを追加 → カスタムSAMLアプリを追加
3. アプリ名: `FileWing`
4. Google IdP情報をコピー（後で環境変数に設定）:
   - SSO URL → `SAML_IDP_SSO_URL`
   - Entity ID → `SAML_IDP_ENTITY_ID`
   - 証明書 → `SAML_IDP_CERT`（Base64エンコード）
5. サービスプロバイダの詳細:
   - ACS URL: `https://your-domain.com/auth/saml/callback`
   - Entity ID: `https://your-domain.com`
   - Name ID形式: EMAIL
6. 属性マッピング（オプション）:
   - email → email
   - name → displayName

**環境変数設定:**

```toml
[env.production]
vars = {
  AUTH_METHOD = "saml",
  SKIP_AUTH = "false",
  EMAIL_FROM = "noreply@your-domain.com",
  SAML_ENTITY_ID = "https://your-domain.com",
  SAML_IDP_SSO_URL = "https://accounts.google.com/o/saml2/idp?idpid=XXXXXX",
  SAML_IDP_ENTITY_ID = "https://accounts.google.com/o/saml2?idpid=XXXXXX",
  SAML_CALLBACK_URL = "https://your-domain.com/auth/saml/callback",
  APP_URL = "https://your-domain.com",
  SESSION_MAX_AGE = "86400",
  ALLOWED_DOMAINS = "company.com,partner.co.jp"
}
```

**シークレット設定:**

```bash
# セッション署名キー（32文字以上のランダム文字列）
wrangler secret put SESSION_SECRET --env production

# IdP X.509証明書（Base64エンコード）
wrangler secret put SAML_IDP_CERT --env production
```

##### オプションB: Cloudflare Access認証

社内限定利用の場合はCloudflare Accessを使用します。

1. Zero Trust → Access → Applications
2. Self-hostedアプリケーションを追加
3. 認証ポリシーを設定（Google/Microsoft/SAML等）

```toml
[env.production]
vars = {
  AUTH_METHOD = "cloudflare-access",
  SKIP_AUTH = "false",
  EMAIL_FROM = "noreply@your-domain.com",
  ACCESS_TEAM_NAME = "your-team-name",
  ACCESS_AUD = "your-application-aud"
}
```

> **注意**: Cloudflare Accessを使用すると、ダウンロードリンク（`/d/:token`）にもAccess認証が適用されます。

## 環境変数一覧

### 基本設定

| 変数名 | 必須 | 説明 | 例 |
|-------|:----:|------|-----|
| `AUTH_METHOD` | - | 認証方式（省略時は自動判定） | `saml`, `cloudflare-access`, `skip` |
| `SKIP_AUTH` | - | 認証スキップ（開発用） | `true` |
| `EMAIL_FROM` | ○ | 送信元メールアドレス | `noreply@example.com` |

### SAML認証設定（AUTH_METHOD=saml時）

| 変数名 | 必須 | 説明 | 例 |
|-------|:----:|------|-----|
| `SAML_ENTITY_ID` | ○ | SP Entity ID | `https://your-domain.com` |
| `SAML_IDP_SSO_URL` | ○ | IdP SSO URL | `https://accounts.google.com/o/saml2/idp?...` |
| `SAML_IDP_ENTITY_ID` | ○ | IdP Entity ID | `https://accounts.google.com/o/saml2?...` |
| `SAML_CALLBACK_URL` | ○ | ACS URL | `https://your-domain.com/auth/saml/callback` |
| `SAML_IDP_CERT` | ○ | IdP X.509証明書（Base64） | シークレットとして設定 |
| `SESSION_SECRET` | ○ | セッション署名キー | シークレットとして設定（32文字以上） |
| `SESSION_MAX_AGE` | - | セッション有効期限（秒） | `86400`（デフォルト: 1日） |
| `APP_URL` | - | アプリケーションURL | `https://your-domain.com` |
| `ALLOWED_DOMAINS` | - | 許可ドメイン（カンマ区切り） | `company.com,partner.co.jp` |

### Cloudflare Access設定（AUTH_METHOD=cloudflare-access時）

| 変数名 | 必須 | 説明 | 例 |
|-------|:----:|------|-----|
| `ACCESS_TEAM_NAME` | ○ | Cloudflare Accessチーム名 | `your-team-name` |
| `ACCESS_AUD` | - | アプリケーションAUD | `your-application-aud` |

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
| GET | `/login` | ログインページ（SAML認証時） |
| GET | `/auth/login` | SAML認証開始 |
| POST | `/auth/saml/callback` | SAMLレスポンス受信 |
| GET | `/auth/saml/metadata` | SPメタデータ（XML） |
| GET/POST | `/auth/logout` | ログアウト |

## プロジェクト構造

```
FileWing/
├── src/
│   ├── index.ts              # エントリーポイント
│   ├── scheduled.ts          # 定期クリーンアップ
│   ├── types/                # 型定義
│   ├── middleware/           # 認証・言語ミドルウェア
│   ├── i18n/                 # 多言語対応
│   ├── services/
│   │   ├── r2.ts             # R2ストレージ操作
│   │   ├── d1.ts             # D1データベース操作
│   │   ├── email.ts          # メール送信
│   │   ├── session.ts        # セッションJWT管理
│   │   └── saml/             # SAML SSO認証
│   ├── utils/                # 暗号化・MIME検証ユーティリティ
│   ├── routes/
│   │   ├── api/              # REST API
│   │   ├── auth/             # SAML認証エンドポイント
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

- **認証**: SAML SSO（セッションJWT）またはCloudflare Access（JWT検証）
- **セッション**: HMAC-SHA256署名、HttpOnly/Secure Cookie
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
- **孤児リンククリーンアップ**: 削除済みファイルに紐づくリンク・履歴をD1から削除

### 手動削除

管理画面（`/files`）から個別にファイルを削除可能。
ファイル削除時は関連するダウンロードリンク・送信先履歴・ダウンロード履歴もD1から完全削除される。

## 技術スタック

- **ランタイム**: Cloudflare Workers
- **フレームワーク**: [Hono](https://hono.dev/) v4
- **ストレージ**: Cloudflare R2（容量無制限）
- **データベース**: Cloudflare D1
- **認証**: SAML 2.0 SSO / Cloudflare Access
- **メール**: Cloudflare Email Sending
- **UI**: Tailwind CSS

## トラブルシューティング

### SAML認証関連

**「SAML設定が不完全です」エラー**
- 必要な環境変数がすべて設定されているか確認
- `SAML_IDP_CERT`と`SESSION_SECRET`はシークレットとして設定が必要

**「このドメインからのログインは許可されていません」エラー**
- `ALLOWED_DOMAINS`に許可するドメインが含まれているか確認
- ドメインはカンマ区切りで複数指定可能

**セッション切れが頻発する**
- `SESSION_MAX_AGE`を増やす（デフォルト: 86400秒 = 1日）

**SPメタデータの確認**
- `https://your-domain.com/auth/saml/metadata` でSPメタデータを確認可能
- IdP設定時のACS URL、Entity IDの確認に使用

### 認証方式の自動判定

`AUTH_METHOD`を省略した場合、以下の順序で自動判定されます:
1. `SKIP_AUTH=true` → skip
2. SAML関連の環境変数がすべて設定されている → saml
3. `ACCESS_TEAM_NAME`または`ACCESS_AUD`が設定されている → cloudflare-access
4. 上記以外 → skip

## ライセンス

MIT
