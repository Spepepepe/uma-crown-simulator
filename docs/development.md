# 開発ガイド

## 前提条件

- Node.js 20+
- Docker Desktop
- AWS CLI（本番環境操作時）

## 開発環境のセットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` を参考に `.env` ファイルを作成します。

```env
# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/uma_crown
POSTGRES_USER=uma_crown
POSTGRES_PASSWORD=uma_crown_dev
POSTGRES_DB=uma_crown

# AWS Cognito
COGNITO_USER_POOL_ID=ap-northeast-1_XXXXXXXXX
COGNITO_CLIENT_ID=your-client-id
COGNITO_REGION=ap-northeast-1

# CORS
CORS_ORIGIN=http://localhost:4200

# Node
NODE_ENV=development
```

### 3. 起動（Docker Compose）

```bash
docker compose up
```

| サービス | URL | 備考 |
|---------|-----|------|
| Frontend | http://localhost:4200 | Angular dev server |
| Backend | http://localhost:3000 | NestJS |
| PostgreSQL | localhost:5432 | |

## データベース

### マイグレーション

```bash
# マイグレーション実行
npm run -w backend prisma:migrate

# Prisma Client 生成
npm run -w backend prisma:generate
```

### シードデータ投入

```bash
npm run -w backend seed
```

## テスト

外部サービス（Cognito・PostgreSQL）はすべてモック化するため、**DB 不要でローカル実行**できます。

### バックエンド

```bash
# 単体テスト
npm run -w backend test

# E2E テスト
npm run -w backend test:e2e
```

### フロントエンド

```bash
# 単体テスト（ウォッチモード）
npm run -w frontend test

# 1回実行（CI 向け）
cd frontend && npx ng test --watch=false
```

### テスト技術スタック

| 対象 | フレームワーク | モック |
|------|--------------|--------|
| バックエンド 単体 | Jest + ts-jest | PrismaService・Cognito を手動モック |
| バックエンド E2E | Jest + Supertest | NestJS TestingModule + MockAuthGuard |
| フロントエンド 単体 | Vitest (`@angular/build:unit-test`) | Angular TestBed + `vi.mock()` |

テスト構成・シナリオの詳細は [testing.md](testing.md) を参照してください。

## ビルド

### フロントエンド（本番ビルド）

```bash
npm run -w frontend build
# 成果物: frontend/dist/
```

### バックエンド（Docker イメージ）

```bash
docker build -t uma-crown-backend ./backend
```

