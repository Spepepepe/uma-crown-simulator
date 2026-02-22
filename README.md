# uma-crown-simulator

ウマ娘の全冠達成を支援する Web アプリケーションです。

## 背景

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
- **コンテナ**: Docker / Docker Compose
- **オーケストレーション**: Kubernetes (Docker Desktop)

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                     Client (Browser)                    │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│              Frontend (nginx / Angular)                 │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  AuthGuard   │  │  HttpClient  │  │   Cognito SDK │  │
│  │  (Router)    │  │ (Interceptor)│  │  (SignIn/Up)  │  │
│  └─────────────┘  └──────┬───────┘  └───────────────┘  │
└──────────────────────────┼──────────────────────────────┘
                  /api/*   │  nginx reverse proxy
┌──────────────────────────▼──────────────────────────────┐
│               Backend (NestJS)                          │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────┐  │
│  │AuthGuard │  │ Cognito   │  │  Feature Modules     │  │
│  │(Global)  │──│ Verifier  │  │  ┌────────────────┐  │  │
│  └──────────┘  └───────────┘  │  │  Umamusume     │  │  │
│                               │  │  Race           │  │  │
│                               │  │  RacePattern    │  │  │
│                               │  └────────────────┘  │  │
│                               └──────────┬───────────┘  │
│                                          │ Prisma ORM   │
└──────────────────────────────────────────┼──────────────┘
┌──────────────────────────────────────────▼──────────────┐
│                   PostgreSQL 16                         │
└─────────────────────────────────────────────────────────┘
```

フロントエンドとバックエンドで TypeScript + `@shared/types` を共有し、API の型安全性を担保しています。認証は Amazon Cognito に委譲し、バックエンドでは JWT トークンの検証のみを行うステートレスな構成です。

## プロジェクト構成

```
Uma_Crown_Simulator/
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
│   │   ├── health/                  # ヘルスチェック (k8s Probe 用)
│   │   ├── seed/                    # 初期データ投入
│   │   └── main.ts                  # アプリケーションエントリポイント
│   ├── test/
│   │   ├── unit/                    # Jest 単体テスト (src/ 構造をミラー)
│   │   └── e2e/                     # Jest + Supertest E2E テスト
│   ├── prisma/
│   │   └── schema.prisma            # データベーススキーマ定義
│   ├── data/                        # シードデータ (JSON)
│   └── Dockerfile                   # バックエンドコンテナ
│
├── shared/                          # 共有パッケージ (@uma-crown/shared)
│   ├── types/
│   │   ├── domain.ts                # ドメインモデル型定義 (Umamusume, Race, RacePattern 等)
│   │   ├── api.ts                   # API リクエスト/レスポンス型定義
│   │   └── index.ts                 # domain / api の再エクスポート
│   └── package.json
│
├── k8s/                             # Kubernetes マニフェスト
│   ├── namespace.yaml               # uma-crown 名前空間
│   ├── postgres-deployment.yaml     # PostgreSQL (PVC + Recreate 戦略)
│   ├── backend-deployment.yaml      # Backend (ClusterIP)
│   ├── frontend-deployment.yaml     # Frontend (NodePort 30080)
│   ├── configmap.yaml               # 非機密設定値
│   ├── secret.yaml                  # 機密情報 (DB / Cognito)
│   ├── ingress.yaml                 # Ingress ルーティング
│   ├── deploy.sh                    # デプロイスクリプト
│   └── teardown.sh                  # リソース削除スクリプト
│
├── docker-compose.yml               # 開発環境オーケストレーション
├── .env.example                     # 環境変数テンプレート
└── package.json                     # npm workspaces ルート定義
```

### モジュール詳細

#### `shared/` - 共有型定義パッケージ

npm workspaces で `@uma-crown/shared` として公開。フロントエンド・バックエンド間で共通のインターフェースを定義し、API の入出力に対する型安全性を保証します。

主な型: `Umamusume`, `Race`, `RemainingRace`, `RacePattern`, `RaceSlot`, `LoginRequest`, `AuthResponse` 等

#### `frontend/src/app/core/` - アプリケーション基盤層

認証に関する横断的関心事を集約。`AuthService` は Angular Signals でトークン状態をリアクティブに管理し、`HttpInterceptor` が全リクエストに Bearer トークンを自動付与します。`AuthGuard` は未認証ユーザーをログイン画面にリダイレクトします。

#### `frontend/src/app/features/` - 機能モジュール群

各機能は Angular の遅延読み込み (Lazy Loading) で分割され、初期バンドルサイズを最適化しています。

| モジュール | 概要 |
|-----------|------|
| `auth/` | Cognito ベースのログイン・ユーザー登録 |
| `character-regist/` | 未登録ウマ娘の選択と初期レース完了状態の一括登録 |
| `character-list/` | 登録済みウマ娘の一覧と適性情報のビジュアル表示 |
| `race-list/` | 全レース一覧 (馬場・距離フィルタ付き、未認証でもアクセス可) |
| `remaining-race/` | 全冠達成に向けた残レース管理・育成パターン提案・手動レース登録 |

#### `backend/src/common/` - 横断的関心事

NestJS のモジュールシステムを活用し、認証・DB アクセスなどの共通機能をグローバルモジュールとして提供。`@Public()` デコレータで個別エンドポイントの認証スキップを宣言的に制御します。

#### `backend/src/race/` - レース管理モジュール

本アプリケーションのコアロジック。`RacePatternService` は、ウマ娘の適性・シナリオ制約・レーススケジュールの競合を考慮した組合せ最適化アルゴリズムにより、全冠達成に向けた複数の育成ローテーションパターン (ラーク / メイクラ / 伝説) を生成します。

#### `k8s/` - Kubernetes マニフェスト

各サービスを独立した Pod として管理。PostgreSQL は `Recreate` 戦略と PersistentVolumeClaim でデータ永続性を確保。フロントエンドの nginx が `/api/` パスをバックエンドにリバースプロキシし、CORS 不要な統一オリジン構成を実現しています。

## 育成パターン計算アルゴリズム

### 問題の背景

全冠対象レースは **155個**、育成で出走できるターン（スロット）は**最大 60**（ジュニア 12 + クラシック 24 + シニア 24）です。
1回の育成ですべてを消化することは不可能なため、残レースを複数の育成ローテーションに分配する必要があります。

さらに以下の制約が絡み合います。

- 同一スロット（月・前後半）には 1レースしか出走できない
- 連続 4 戦以上の出走は禁止（ゲームルール）
- シナリオ（伝説）では特定レースが目標として固定される
- L'Arc（ラーク）シナリオはクラシック 7〜10 月・シニア 6 月後半以降の自由出走が禁止

### 旧実装の問題点（逐次 Greedy）

初期実装は「1パターンのスロットを前から順に埋めていく」逐次 Greedy 方式でした。
この方式には**前詰め問題**があり、早いスロットにレースが集中して後半のパターンに偏りが生じ、パターン数が過剰になるという欠点がありました。

### 現行実装：グリッドベース一括割り当て

[`backend/src/race/race-pattern.service.ts`](backend/src/race/race-pattern.service.ts) で実装。

#### Phase 1 — スロット圧力によるパターン数の決定

各残レースは走れる期（ジュニア / クラシック / シニア）に応じてスロットに**ウェイト**を分配します。

```
classic のみ出走可  → そのスロットに weight = 1.0
classic + senior 両方 → 各スロットに weight = 0.5
```

全スロットのウェイト合計（**圧力**）を求め、最大値の `ceil` が必要メイクラパターン数になります。

```
Nメイクラ = ceil( max(圧力[S]) for all S )
N合計     = Nメイクラ + (シナリオレースが存在すれば +1)
```

#### Phase 2 — グリッドへの一括割り当て

`Grid[patternIndex][slotKey]` という 2 次元構造に対して全残レースを一括で割り当てます。
割り当て順は「配置できるスロットが少ない（制約が厳しい）レースを先に」とし、各候補に以下のスコアを付けて最良手を選択します。

| スコア要素 | 概要 |
|-----------|------|
| 因子戦略一致 | ウマ娘の不足因子（バ場・距離）と一致すれば +2〜+4 |
| 連続出走抑制 | 前後のスロットへの連続配置が長いほど減点 |
| グレード優先 | G1 > G2 > G3 の順に優先配置 |

#### 制約の実装

| 制約 | 処理 |
|------|------|
| 連続 4 戦禁止 | スロット線形順序（60スロット通し番号）上で隣接スロットを走査し、連続長が 3 以上になる配置を禁止。シナリオ固定レースはカウント対象外 |
| L'Arc 制限スロット | ラーク候補パターンでは classic 7〜10 月前半・senior 6 月後半以降への通常レース配置を禁止 |
| シナリオレース分離 | 通常割り当て対象から除外し、伝説パターン（index=0）に固定配置 |

#### Phase 3 — パターン後処理

グリッドから各パターンのスロット配列（junior / classic / senior）を構築し、
ラーク変換判定・シナリオ名確定（伝説 / ラーク / メイクラ）・因子構成計算・主バ場/距離の集計を行います。

---

## 主要機能

- **ウマ娘管理**: 所持ウマ娘の登録・一覧表示、適性情報の可視化
- **レース情報**: G1/G2/G3レース一覧、馬場・距離による絞り込み
- **残レース表示**: 全冠達成に必要な残りレースをウマ娘ごとに集計・表示
- **育成パターン提案**: 適性・シナリオ制約を考慮した最適な育成ローテーションを複数パターン自動生成
- **認証**: Amazon Cognito によるユーザー認証・セッション管理

## API エンドポイント

### 認証 (`/api/v1/auth/`)
| Method | Path | 認証 | 概要 |
|--------|------|------|------|
| POST | `/auth/login` | 不要 | ログイン |
| POST | `/auth/signup` | 不要 | ユーザー登録 |

### ウマ娘 (`/api/v1/umamusumes/`)
| Method | Path | 認証 | 概要 |
|--------|------|------|------|
| GET | `/umamusumes` | 必要 | 全ウマ娘一覧 |
| GET | `/umamusumes/unregistered` | 必要 | 未登録ウマ娘一覧 |
| GET | `/umamusumes/registered` | 必要 | 登録済みウマ娘一覧 |
| POST | `/umamusumes/registrations` | 必要 | ウマ娘登録 + 初期レース登録 |

### レース (`/api/v1/races/`)
| Method | Path | 認証 | 概要 |
|--------|------|------|------|
| GET | `/races` | 不要 | レース一覧 (フィルタ対応) |
| GET | `/races/registration-targets` | 必要 | 登録用レース一覧 |
| GET | `/races/remaining` | 必要 | 全ウマ娘の残レース集計 |
| GET | `/races/remaining/:id/:season/:month/:half` | 必要 | 月別残レース取得 |
| POST | `/races/run` | 必要 | レース出走登録 |
| POST | `/races/pattern/:id` | 必要 | パターン一括登録 |

### ヘルスチェック
| Method | Path | 認証 | 概要 |
|--------|------|------|------|
| GET | `/health` | 不要 | k8s Probe 用ヘルスチェック |

## 環境構成

開発環境と本番環境は分離されています。

### 開発環境 (Docker Compose)

Docker Desktop の Kubernetes を使用してローカルにデプロイします。

```bash
# デプロイ
cd k8s
bash deploy.sh

# 削除
bash teardown.sh
```

| サービス | アクセス | 備考 |
|---------|---------|------|
| Frontend | NodePort 30080 | nginx で静的ファイル配信 + API プロキシ |
| Backend | ClusterIP | フロントエンドの nginx 経由でアクセス |
| PostgreSQL | ClusterIP | クラスタ内部のみ |

フロントエンドの nginx が `/api/` へのリクエストをバックエンドにプロキシするため、フロントエンドは相対パス `/api/v1` でAPIにアクセスします。

## 環境変数

`.env.example` を参考に `.env` ファイルを作成してください。

```env
# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/uma_crown
POSTGRES_USER=uma_crown
POSTGRES_PASSWORD=uma_crown_dev
POSTGRES_DB=uma_crown

# AWS Cognito
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=your-client-id
COGNITO_REGION=us-east-1

# CORS
CORS_ORIGIN=http://localhost:4200

# Node
NODE_ENV=development
```

## テスト

### テスト構成

テストは各パッケージの `test/` ディレクトリに配置し、`src/` の構造をミラーリングしています。
外部サービス（Cognito・PostgreSQL）はすべてモック化するため、**Kubernetes や DB 不要でローカル単体実行**できます。

```
backend/
└── test/
    ├── unit/                          # Jest 単体テスト
    │   ├── auth/
    │   │   └── auth.service.spec.ts   # AuthService
    │   ├── common/guards/
    │   │   └── auth.guard.spec.ts     # AuthGuard (JWT 検証)
    │   ├── race/
    │   │   ├── race.service.spec.ts
    │   │   └── race-pattern.service.spec.ts
    │   └── umamusume/
    │       └── umamusume.service.spec.ts
    └── e2e/                           # Jest + Supertest E2E テスト
        ├── race.e2e-spec.ts
        └── umamusume.e2e-spec.ts

frontend/
└── test/
    └── unit/                          # Vitest 単体テスト
        ├── core/
        │   ├── guards/
        │   │   └── auth.guard.spec.ts
        │   ├── interceptors/
        │   │   └── auth.interceptor.spec.ts
        │   └── services/
        │       ├── auth.service.spec.ts
        │       ├── character.service.spec.ts
        │       └── race.service.spec.ts
        └── shared/
            ├── components/toast/
            │   └── toast.service.spec.ts
            └── utils/
                ├── race-formatter.spec.ts
                └── color-mapper.spec.ts
```

### テスト技術スタック

| 対象 | フレームワーク | モック |
|------|--------------|--------|
| バックエンド 単体 | Jest + ts-jest | PrismaService・Cognito を手動モック |
| バックエンド E2E | Jest + Supertest | NestJS TestingModule + MockAuthGuard |
| フロントエンド 単体 | Vitest (`@angular/build:unit-test`) | Angular TestBed + `vi.mock()` |

### 実行方法

#### バックエンド

```bash
# 単体テスト
npm run -w backend test

# E2E テスト
npm run -w backend test:e2e
```

#### フロントエンド

```bash
# 単体テスト（ウォッチモード・デフォルト）
npm run -w frontend test

# 1回実行して終了（CI 向け）
cd frontend && npx ng test --watch=false
```

## データベース

### マイグレーション

```bash
# Prisma マイグレーション実行
npm run -w backend prisma:migrate

# Prisma Client 生成
npm run -w backend prisma:generate
```

### ER図

```mermaid
erDiagram
    UmamusumeTable ||--o{ RegistUmamusumeTable : "1:N"
    UmamusumeTable ||--o{ RegistUmamusumeRaceTable : "1:N"
    UmamusumeTable ||--o{ ScenarioRaceTable : "1:N"
    RaceTable ||--o{ RegistUmamusumeRaceTable : "1:N"
    RaceTable ||--o{ ScenarioRaceTable : "1:N"

    UmamusumeTable {
        int umamusume_id PK
        string umamusume_name
        string turf_aptitude
        string dirt_aptitude
        string sprint_aptitude
        string mile_aptitude
        string classic_aptitude
        string long_distance_aptitude
    }

    RaceTable {
        int race_id PK
        string race_name
        int race_state
        int distance
        int distance_detail
        int num_fans
        int race_months
        int half_flag
        int race_rank
        int junior_flag
        int classic_flag
        int senior_flag
    }

    RegistUmamusumeTable {
        string user_id FK
        int umamusume_id FK
        datetime regist_date
        bigint fans
    }

    RegistUmamusumeRaceTable {
        string user_id FK
        int umamusume_id FK
        int race_id FK
        datetime regist_date
    }

    ScenarioRaceTable {
        int umamusume_id FK
        int race_id FK
        int race_number
        int random_group
        int senior_flag
    }
```
