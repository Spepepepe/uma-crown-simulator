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
| Docker（backend 本番 ECS・dev・k8s） | `node:26.12.1-alpine3.24` |
| frontend 本番ビルド（GitHub Actions → S3） | `.nvmrc` の版（`node-version-file`） |
| ローカル開発・テスト・CI | `v26.12.1`（`.nvmrc` に記載） |

プロジェクトルートの `.nvmrc` でバージョンを固定している。
Docker のベースイメージは Node のパッチ版と Alpine の版まで完全指定する（浮動タグ `node:XX-alpine` は使わない）。
ローカル作業を始める前に必ず以下を実行して Node.js バージョンを合わせること。

```bash
# nvm を使っている場合
nvm use

# バージョン確認
node --version   # → v26.12.1 であること
```

`.nvmrc` のバージョンを変更するときは `backend/Dockerfile`・`frontend/Dockerfile` の `FROM node:X.Y.Z-alpineA.B` も合わせて変更すること。

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
   - 「Read repository contents and packages permissions」（読み取りのみ）を選択する。各ワークフローが `permissions` で必要な権限を明示しているため、既定は最小権限で良い
   - 「Allow GitHub Actions to create and approve pull requests」にチェックを入れる
3. **Save** をクリック

この設定がないと `GITHUB_TOKEN` による PR 作成が `GraphQL: GitHub Actions is not permitted to create or approve pull requests` エラーで失敗する。

### ワークフロー一覧

| ファイル | トリガー | 内容 |
|---|---|---|
| `ci.yml` | develop への push / main・develop への PR / deploy から呼び出し | 脆弱性検査（`npm audit` 本番依存 high 以上）・lint・タイプチェック・ビルドチェック（バック・フロント両面）・ワークフロー検査（actionlint / zizmor） |
| `test.yml` | develop への push / main・develop への PR / deploy から呼び出し | テスト・カバレッジ（分岐網羅 80% 未満で失敗） |
| `create-release-pr.yml` | develop への push | develop → main のリリース PR を自動作成・更新 |
| `sync-main-to-develop.yml` | main への push | main の内容を develop へ同期（fast-forward → マージ → コンフリクト時は PR 作成） |
| `deploy-backend.yml` / `deploy-frontend.yml` | main への push | `ci.yml`・`test.yml` を品質ゲートとして呼び出した後、AWS へデプロイ |

### ワークフローの記述ルール

- `ci.yml` / `test.yml` は reusable workflow（`workflow_call`）を兼ねる。deploy からは `scope: backend` / `scope: frontend` で対象を絞って呼び出す
- action は **コミット SHA で固定** し、バージョンをコメントに残す（例: `uses: actions/checkout@<40桁SHA> # v7.0.1`）。タグ参照は zizmor（`unpinned-uses`）で CI が失敗する。`docker run` で使うイメージも digest で固定する
- 新しい action の SHA は `git ls-remote --tags https://github.com/<owner>/<repo>.git` で取得する（注釈付きタグは `^{}` 側の SHA を使う）
- ワークフロー最上位で `permissions: contents: read` とし、必要なジョブだけ権限を広げる
- `${{ }}` を `run` 内に直接展開しない。`env` で環境変数に渡してから `"$VAR"` で参照する（スクリプトインジェクション対策）
- `actions/checkout` は `persist-credentials: false` を指定する（git push が必要な `sync-main-to-develop.yml` のみ例外）
- 本番成果物を作る deploy ジョブでは `setup-node` のキャッシュを使わない（キャッシュ汚染対策）
- 全ジョブに `timeout-minutes` を設定し、Node バージョンは `node-version-file: .nvmrc` で指定する
- zizmor の設定は `.github/zizmor.yml`。ローカルでの検査:

```bash
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12 -color
docker run --rm -v "$PWD:/repo" -w /repo ghcr.io/zizmorcore/zizmor:1.31.1 --offline --min-severity=low .github/workflows
```

> Git Bash では `MSYS_NO_PATHCONV=1` を付けてパス変換を抑止すること。

### Dependabot

`.github/dependabot.yml` で npm（ルート）・github-actions・docker（backend / frontend）・terraform の更新 PR を develop 向けに作成する（npm / actions / docker は週次、terraform は月次）。
npm の minor / patch と github-actions はグループ化して 1 PR にまとめる。Node のメジャー更新は Dockerfile・`.nvmrc` の整合が必要なため Dependabot の対象外とし、手動で行う。

### main → develop 同期

`sync-main-to-develop.yml` は `GITHUB_TOKEN` で develop へ push する。develop にブランチ保護（push 制限）を設定する場合は GitHub Actions からの push を許可すること。
`GITHUB_TOKEN` による push は他のワークフローをトリガーしないため、同期で CI やリリース PR 作成が再実行されることはない。

### 脆弱性対応用の overrides

ルート `package.json` の `overrides` で、Prisma CLI（6 系）が固定している推移的依存を修正版に差し替えている。

| パッケージ | 理由 |
|---|---|
| `deepmerge-ts` | `@prisma/config@6.x` が脆弱な 7.1.5 を固定しているため 8 系へ |
| `effect` | `@prisma/config@6.x` が脆弱な 3.20 未満を固定しているため |

Prisma を修正済みバージョン（7.11 以降）へ上げた際は、この overrides を削除すること。
なお npm は既存ロックファイルの依存に後から追加した overrides を適用しない不具合があり、`deepmerge-ts` はロックファイル上で 8.0.2 に差し替えている（`npm ls` では invalid と表示されるが `npm ci` は通る）。
`npm install` 等でロックファイルを更新した際に 7.1.5 へ戻ることがあるため、依存更新後は `npm audit --workspace=backend --omit=dev --audit-level=high` で確認すること（CI の Audit ジョブでも検出される）。

### デプロイワークフロー

バックエンド・フロントエンドのデプロイには以下の Secrets が必要:

| Secret 名 | 用途 |
|---|---|
| `AWS_ROLE_ARN` | OIDC で引き受ける IAM ロールの ARN |
| `COGNITO_USER_POOL_ID` | フロントエンドの environment.ts に注入する Cognito 設定 |
| `COGNITO_CLIENT_ID` | 同上 |
| `CLOUDFRONT_DISTRIBUTION_ID` | フロントエンドデプロイ後のキャッシュ無効化に使用 |
