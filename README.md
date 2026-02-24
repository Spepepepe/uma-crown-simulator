# uma-crown-simulator

**https://umacrownsimulator.com**

ウマ娘の全冠達成を支援する Web アプリケーションです。

ウマ娘では G1〜G3 レースで 1 着を取ることで「〇〇全冠」称号が取得できますが、対象レースは全部で **155 個**あるのに対し、1 育成で出走できるターンは **59 しかありません**。さらにバ場（芝 / ダート）・距離（短距離 / マイル / 中距離 / 長距離）の条件やシナリオごとの制約（伝説 / ラーク / メイクラ）が絡み合うため、どのレースをどの育成に割り当てるかを手動で管理するのは非常に困難です。

このアプリはその割り当てを自動計算し、適性・シナリオ制約を考慮した最適な育成ローテーションパターンを複数提案します。

> 詳しい背景・アルゴリズム解説は Qiita 記事をご覧ください
> [ウマ娘の全冠称号を効率化！レースパターン計算機能を作ってみた](https://qiita.com/spepepepe/items/98263fe0637ac280d7a7)

## リプレイス履歴

本プロジェクトは以下の技術スタックを経てリプレイスされてきました。

| 世代 | フロントエンド | バックエンド | 備考 |
|------|---------------|-------------|------|
| 第1世代 | Blade (Laravel 9.19) | PHP (Laravel 9.19) | モノリシック構成 |
| 第2世代 | React | PHP (Laravel 11.31) | フロント・バック分離 |
| 第3世代 | TypeScript (Next.js) | Python (Django REST Framework) | フルリプレイス |
| **第4世代 (現行)** | **Angular + Tailwind CSS** | **NestJS + Prisma** | **モノレポ構成** |

## 技術選定の理由

### 第1世代 — PHP (Laravel) モノリシック

業務で Laravel を使用しており、そのスキルを活かせば「自分が作りたいシステム」を実現できると判断。まず動くものを作ることを優先した。

### 第2世代 — React + Laravel (API)

フロントエンドに React を使ってみたいという動機から、バックエンドを REST API として切り出す構成に移行。SPA + API というアーキテクチャを経験することが目的だった。

### 第3世代 — Next.js + Python (Django REST Framework)

マイクロサービス的なフロント・バック分離を突き詰め、バックエンドを Python で試験的に再構築。フロントは React の延長として Next.js を採用し、バックエンドは別言語を経験することでアーキテクチャへの理解を深めた。

### 第4世代（現行）— Angular + NestJS (TypeScript モノレポ)

実サービスとしての運用を見据え、以下の理由で現在の構成を選定。

- **TypeScript で統一**: フロント・バック間で型定義を共有し、API の型安全性を担保するため両方を TypeScript に統一
- **NestJS**: レースパターン計算など処理速度が求められる機能において Node.js の JIT が有効に働くこと、モジュール単位の責務分散と DI により大規模化に耐える設計ができることから採用
- **Angular**: Next.js で肥大化していたフロントエンドを再設計するにあたり、NestJS と同様にモジュール・DI による責務分散が標準で備わっている Angular を採用。フレームワークとしての一貫性がチーム開発・保守性に寄与すると判断

## 技術スタック

### フロントエンド
- **Framework**: Angular 21
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Build**: esbuild (`@angular/build:application`)

### バックエンド
- **Framework**: NestJS
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL 16
- **Authentication**: Amazon Cognito (JWT)

### インフラ
- **パッケージ管理**: npm workspaces (モノレポ)
- **共有型定義**: `shared/` パッケージ
- **IaC**: Terraform
- **ホスティング**: AWS（CloudFront + S3 + ECS on EC2）
- **CI/CD**: GitHub Actions (OIDC)

## プロジェクト構成

```
uma-crown-simulator/
├── frontend/                        # Angular フロントエンド
│   ├── src/app/
│   │   ├── core/                    # アプリケーション基盤
│   │   │   ├── guards/
│   │   │   │   └── auth.guard.ts    # 認証ルートガード (CanActivateFn)
│   │   │   ├── interceptors/
│   │   │   │   └── auth.interceptor.ts  # JWT Bearer トークン自動付与
│   │   │   └── services/
│   │   │       ├── auth.service.ts      # Cognito 認証 (Signal ベース状態管理)
│   │   │       ├── character.service.ts # ウマ娘 CRUD API クライアント
│   │   │       ├── race.service.ts      # レース API クライアント
│   │   │       └── navigation.service.ts # 画面遷移管理 (Signal ベース)
│   │   ├── features/                # 機能モジュール (遅延読み込み)
│   │   │   ├── auth/
│   │   │   │   ├── login/           # ログイン画面
│   │   │   │   └── register/        # ユーザー登録画面
│   │   │   ├── character-regist/    # ウマ娘登録 (未登録一覧 + レース選択)
│   │   │   ├── character-list/      # 登録済みウマ娘一覧 (適性表示)
│   │   │   ├── race-list/           # レース一覧 (馬場・距離フィルタ)
│   │   │   └── remaining-race/      # 残レース管理
│   │   │       ├── remaining-race-list.ts     # 残レース一覧 (全ウマ娘)
│   │   │       └── remaining-race-pattern.ts  # 育成パターン提案
│   │   ├── shared/components/       # 共有UIコンポーネント
│   │   │   ├── sidebar/             # ナビゲーションサイドバー
│   │   │   ├── aptitude-badge/      # 適性ランクバッジ (S~G)
│   │   │   └── toast/               # トースト通知
│   │   ├── environments/            # 環境別設定 (dev / prod)
│   │   ├── app.routes.ts            # ルーティング定義 (遅延読み込み)
│   │   ├── app.ts                   # ルートコンポーネント
│   │   └── app.config.ts            # DI / Interceptor 設定
│   ├── test/unit/                   # Vitest 単体テスト (src/ 構造をミラー)
│   ├── public/                      # 静的アセット (favicon 等)
│   ├── nginx.conf                   # 本番用リバースプロキシ設定
│   ├── Dockerfile                   # 開発用コンテナ
│   └── Dockerfile.prod              # 本番用マルチステージビルド
│
├── backend/                         # NestJS バックエンド
│   ├── src/
│   │   ├── common/                  # 横断的関心事
│   │   │   ├── cognito/             # Cognito JWT 検証サービス
│   │   │   ├── guards/              # グローバル認証ガード
│   │   │   ├── decorators/          # @CurrentUser(), @Public()
│   │   │   └── prisma/              # Prisma クライアント (グローバルモジュール)
│   │   ├── auth/                    # 認証エンドポイント
│   │   ├── umamusume/               # ウマ娘 CRUD
│   │   │   ├── umamusume.controller.ts  # GET/POST エンドポイント
│   │   │   └── umamusume.service.ts     # 登録・検索ロジック
│   │   ├── race/                    # レース管理
│   │   │   ├── race.controller.ts       # レース API エンドポイント
│   │   │   ├── race.service.ts          # レース検索・残レース集計
│   │   │   └── race-pattern.service.ts  # 育成パターン生成アルゴリズム
│   │   ├── health/                  # ヘルスチェック (ECS Probe 用)
│   │   └── seed/                    # 初期データ投入
│   ├── test/
│   │   ├── unit/                    # Jest 単体テスト (src/ 構造をミラー)
│   │   └── e2e/                     # Jest + Supertest E2E テスト
│   ├── prisma/
│   │   └── schema.prisma            # データベーススキーマ定義
│   └── data/                        # シードデータ (JSON)
│
├── shared/                          # 共有パッケージ (@uma-crown/shared)
│   ├── types/
│   │   ├── domain.ts                # ドメインモデル型定義 (Umamusume, Race, RacePattern 等)
│   │   ├── api.ts                   # API リクエスト/レスポンス型定義
│   │   └── index.ts                 # domain / api の再エクスポート
│   └── package.json
│
├── terraform/                       # IaC (Terraform)
│   └── modules/
│       ├── networking/              # VPC, Subnet, SG, EIP
│       ├── frontend/                # S3, CloudFront
│       ├── backend/                 # EC2, ECS, ECR, EBS
│       ├── auth/                    # Cognito
│       ├── management/              # SSM, CloudWatch Logs
│       ├── dns/                     # Route53, ACM
│       └── cicd/                    # GitHub Actions OIDC, IAM Role
│
├── docs/                            # ドキュメント
├── docker-compose.yml               # 開発環境オーケストレーション
├── .env.example                     # 環境変数テンプレート
└── package.json                     # npm workspaces ルート定義
```

## ドキュメント

| ドキュメント | 内容 |
|------------|------|
| [docs/architecture.md](docs/architecture.md) | システム構成図・モジュール詳細・ER図 |
| [docs/algorithm.md](docs/algorithm.md) | 育成パターン計算アルゴリズム |
| [docs/api.md](docs/api.md) | API エンドポイント一覧 |
| [docs/development.md](docs/development.md) | 開発環境・テスト・ビルド手順 |
| [docs/infrastructure.md](docs/infrastructure.md) | AWS インフラ構成・Terraform デプロイ手順 |
