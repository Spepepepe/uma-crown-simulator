# Uma Crown Simulator - 開発環境操作

---

## ローカル開発環境の選択

| 方式 | 用途 | 起動コマンド |
|---|---|---|
| **docker compose**（推奨） | 日常の開発・デバッグ。ホットリロード対応 | `docker compose up` |
| **k8s** | 本番に近い構成での検証 | `bash k8s/deploy.sh` |
| **フロントエンド単体** | フロントエンドのみ開発（バックエンド不要時） | `cd frontend && npm start` |

---

## ローカル開発（docker compose）

### 前提条件

- Docker Desktop がインストールされていること
- `.env` ファイルが存在すること（`.env.example` をコピーして作成）

```bash
cp .env.example .env
# .env の値を環境に合わせて編集（ローカル開発ならデフォルト値のままでOK）
```

### 起動

```bash
docker compose up
```

| サービス | URL | 説明 |
|---|---|---|
| フロントエンド | `http://localhost:4200` | Angular 開発サーバー（ホットリロード） |
| バックエンド | `http://localhost:3000` | NestJS 開発サーバー（ホットリロード） |
| PostgreSQL | `localhost:5432` | DB 直接接続（デバッグ用） |

### ホットリロードの仕組み

- ソースコード（`backend/`, `frontend/`, `shared/`）はボリュームマウントでコンテナと共有
- `node_modules` は named volume で管理（ホストとコンテナで分離）
- バックエンド: `nest start --watch` が変更を検知して自動リスタート
- フロントエンド: `ng serve` が変更を検知してブラウザを自動リロード

### よく使うコマンド

```bash
# バックグラウンドで起動
docker compose up -d

# ログ確認
docker compose logs -f backend
docker compose logs -f frontend

# コンテナに入る（デバッグ）
docker compose exec backend sh
docker compose exec frontend sh

# package.json や Dockerfile を変更した場合はリビルドが必要
docker compose up --build

# 停止（データは保持）
docker compose down

# 停止 + データ削除（DB データ・node_modules を含む完全リセット）
docker compose down -v
```

### Prisma の操作（docker compose 環境）

```bash
# スキーマを DB にプッシュ（初回 or スキーマ変更時）
docker compose exec backend npx prisma db push

# Prisma Client 再生成
docker compose exec backend npx prisma generate

# Prisma Studio（DB の GUI 確認）
docker compose exec backend npx prisma studio
```

### トラブルシューティング

| 症状 | 対処 |
|---|---|
| `node_modules` の不整合 | `docker compose down -v && docker compose up --build` で named volume を再作成 |
| DB 接続エラー | PostgreSQL の healthcheck が通るまで待つ。`docker compose logs postgres` で確認 |
| ポート競合 | ホスト側で既に 3000/4200/5432 を使用していないか確認 |

---

## ローカルデプロイ（k8s）

本番に近い構成でテストする場合に使用する。日常開発には docker compose を推奨する。

```bash
bash k8s/deploy.sh
```

アクセス URL: `http://localhost:30080`

### 内部処理の流れ

1. **Docker ビルド**
   - `backend/Dockerfile --target prod`（NestJS + Prisma）
   - `frontend/Dockerfile --target prod`（Angular + nginx）
     - `environment.development.ts` から `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` を読み取り
       `--build-arg` で渡して `environment.ts` に注入してビルド

2. **k8s マニフェスト適用順**
   ```
   namespace.yaml           → uma-crown Namespace
   configmap.yaml           → backend-config（NODE_ENV, PORT, CORS_ORIGIN）
   secret.yaml              → backend-secret（DB認証情報・Cognito認証情報）
   postgres-deployment.yaml → PVC + Deployment + Service
   backend-deployment.yaml  → Deployment + Service（envFrom: configmap + secret）
   frontend-deployment.yaml → Deployment + NodePort Service（:30080）
   ingress.yaml             → Ingress（任意）
   ```

3. **Pod 再起動・待機**
   - `imagePullPolicy: Never` のためマニフェスト変更がなくても毎回 `rollout restart` が必要

---

## k8s 動作確認コマンド

### 全リソース確認

```bash
kubectl get all -n uma-crown
```

### Pod の状態確認

```bash
kubectl get pods -n uma-crown
```

### ログ確認

```bash
# バックエンドログ
kubectl logs -n uma-crown deploy/backend

# フロントエンドログ
kubectl logs -n uma-crown deploy/frontend

# リアルタイムで流す
kubectl logs -n uma-crown deploy/backend -f
```

### Pod に入る（デバッグ）

```bash
kubectl exec -it -n uma-crown deploy/backend -- sh
kubectl exec -it -n uma-crown deploy/frontend -- sh
```

### Pod 再起動

```bash
kubectl rollout restart deployment/backend -n uma-crown
kubectl rollout restart deployment/frontend -n uma-crown
```

### デプロイ状態の待機確認

```bash
kubectl rollout status deployment/backend -n uma-crown --timeout=120s
kubectl rollout status deployment/frontend -n uma-crown --timeout=120s
```

---

## k8s 環境の削除・リセット

```bash
bash k8s/teardown.sh
```

---

## Cognito 設定（ローカル環境）

`frontend/src/app/environments/environment.development.ts` に記載。
デプロイスクリプトがここから値を読み取り `--build-arg` で Docker に渡す。

---

## Node.js バージョン管理（ローカル開発）

### バージョン固定

| 環境 | Node.js バージョン |
|---|---|
| Docker（本番・k8s） | `node:20-alpine`（Node.js 20 系） |
| ローカル開発・テスト | `v20.20.0`（`.nvmrc` に記載） |

プロジェクトルートの `.nvmrc` でバージョンを固定している。
ローカル作業を始める前に必ず以下を実行して Node.js バージョンを合わせること。

```bash
# nvm を使っている場合
nvm use

# バージョン確認
node --version   # → v20.20.0 であること
```

`.nvmrc` のバージョンを変更するときは `backend/Dockerfile` の `FROM node:XX-alpine` も合わせて変更すること。

### nvm が入っていない場合

```bash
# nvm インストール（macOS）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# .nvmrc のバージョンをインストール
nvm install
nvm use
```

---

## フロントエンド単体開発（docker compose / k8s なし）

```bash
cd frontend
npm install
npm start
```

アクセス URL: `http://localhost:4200`

---

## npm scripts

### バックエンド（プロジェクトルートから実行）

`backend/` 内の jest 設定（ts-jest）を正しく読み込むため、テストは `npm --prefix` で実行する。

| コマンド | 内容 |
|---|---|
| `npm --prefix backend run start:dev` | ホットリロードで開発サーバー起動 |
| `npm --prefix backend run build` | NestJS ビルド（tsc-alias でパスエイリアス解決） |
| `npm --prefix backend run lint` | ESLint（--fix 付き） |
| `npm --prefix backend test` | Jest ユニットテスト（全件） |
| `npm --prefix backend test -- --testPathPatterns="test/unit/xxx"` | 特定ディレクトリのテストのみ実行 |
| `npm --prefix backend run test:cov` | カバレッジレポート生成 |
| `npm --prefix backend run test:e2e` | E2E テスト |
| `npm --prefix backend run prisma:generate` | Prisma Client 再生成 |
| `npm --prefix backend run prisma:push` | スキーマを DB にプッシュ（開発用） |

### フロントエンド（`frontend/` で実行）

| コマンド | 内容 |
|---|---|
| `npm start` | 開発サーバー起動（localhost:4200） |
| `npm run build` | 本番ビルド |
| `npm run test` | Angular テスト（vitest） |
| `npm run watch` | ウォッチモードビルド |

---

## ブランチ戦略

| ブランチ | 役割 |
|---|---|
| `main` | 本番リリース用 |
| `develop` | 開発統合ブランチ |

- 作業は `develop` で行い、PR を `main` へ出してリリース
- PR のベースブランチは原則 `main`

---

## GitHub Actions 前提設定

### リリース PR 自動作成

`develop` への push 時に `main` への PR を自動作成するワークフロー（`create-release-pr.yml`）を使用している。

**必要なリポジトリ設定:**

1. GitHub リポジトリの **Settings > Actions > General** を開く
2. **Workflow permissions** セクションで以下を設定:
   - 「Read and write permissions」を選択
   - 「Allow GitHub Actions to create and approve pull requests」にチェックを入れる
3. **Save** をクリック

この設定がないと `GITHUB_TOKEN` による PR 作成が `GraphQL: GitHub Actions is not permitted to create or approve pull requests` エラーで失敗する。

### デプロイワークフロー

バックエンド・フロントエンドのデプロイには以下の Secrets が必要:

| Secret 名 | 用途 |
|---|---|
| `AWS_ROLE_ARN` | OIDC で引き受ける IAM ロールの ARN |
| `COGNITO_USER_POOL_ID` | フロントエンドの environment.ts に注入する Cognito 設定 |
| `COGNITO_CLIENT_ID` | 同上 |
| `CLOUDFRONT_DISTRIBUTION_ID` | フロントエンドデプロイ後のキャッシュ無効化に使用 |
