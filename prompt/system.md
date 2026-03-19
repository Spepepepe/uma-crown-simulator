# Uma Crown Simulator - システム全容

このファイルを読んだ AI はプロジェクトの全容を把握し、コード修正・質問対応・レビューを行ってください。

---

## プロジェクト概要

ウマ娘育成ゲームの **全冠称号取得** を支援するシミュレーターアプリ。
育成したウマ娘の適性・因子情報を登録し、全冠称号までに必要な残レースと出走パターンを照合・計算する。

---

## 技術スタック

| 層 | 技術 |
|---|---|
| フロントエンド | Angular (standalone コンポーネント) + Tailwind CSS v4 |
| バックエンド | NestJS (ESM) + Prisma ORM |
| DB | PostgreSQL |
| 認証 | AWS Cognito (amazon-cognito-identity-js) |
| インフラ | Kubernetes (ローカル: Docker Desktop k8s) |
| 共有型 | `shared/` パッケージ（フロント・バック共通の型定義） |

---

## ディレクトリ構成

```
uma-crown-simulator/
├── frontend/              # Angular アプリ
│   ├── src/app/
│   │   ├── app.ts                          # ルートコンポーネント（画面切り替え）
│   │   ├── app.config.ts                   # グローバル設定・HTTP インターセプター登録
│   │   ├── core/
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts         # Cognito 認証（login/logout/signUp/confirmSignUp）
│   │   │   │   ├── navigation.service.ts   # SPA 画面遷移管理（ViewState signal）
│   │   │   │   ├── character.service.ts    # ウマ娘 API 呼び出し
│   │   │   │   └── race.service.ts         # レース API 呼び出し
│   │   │   ├── guards/auth.guard.ts        # 現在未使用（NavigationService で制御）
│   │   │   └── interceptors/auth.interceptor.ts  # JWT トークンを Authorization ヘッダーに付与
│   │   ├── features/
│   │   │   ├── landing/landing.ts          # LP（初期画面・機能説明）
│   │   │   ├── auth/
│   │   │   │   ├── login/login.ts          # ログイン画面
│   │   │   │   └── register/register.ts   # 会員登録画面（2ステップ: 登録 → 確認コード）
│   │   │   ├── character-list/             # 登録済みウマ娘一覧
│   │   │   ├── character-regist/           # ウマ娘情報登録
│   │   │   ├── race-list/                  # レース一覧
│   │   │   └── remaining-race/             # 残レース一覧・出走パターン計算
│   │   └── shared/
│   │       └── components/
│   │           ├── sidebar/sidebar.ts      # ナビゲーションサイドバー
│   │           └── toast/                  # トースト通知
│   └── public/image/
│       ├── backgroundFile/                 # 各画面の背景画像
│       └── SidebarTab/                     # サイドバータブの背景画像
├── backend/               # NestJS アプリ
│   └── src/
│       ├── app.module.ts                   # ルートモジュール（グローバル AuthGuard 設定）
│       ├── auth/                           # 認証関連（Cognito トークン検証）
│       ├── umamusume/                      # ウマ娘 CRUD
│       ├── race/
│       │   ├── race.controller.ts          # レース API エンドポイント
│       │   ├── race.service.ts             # レース取得・出走登録
│       │   └── pattern/race-pattern.service.ts  # 全冠照合・出走パターン計算
│       ├── seed/                           # 初期データ投入
│       └── common/
│           ├── cognito/                    # Cognito JWT 検証サービス
│           ├── guards/auth.guard.ts        # グローバル認証ガード（@Public() で除外可）
│           └── decorators/                 # @CurrentUser() / @Public()
├── shared/                # フロント・バック共通の型定義
├── k8s/                   # Kubernetes マニフェスト
├── prompt/                # AI 向けコンテキスト・プロンプト集（このディレクトリ）
└── script/                # 開発補助スクリプト
```

---

## フロントエンド設計

### 画面遷移の仕組み
- Angular Router **未使用**。`NavigationService` の `currentView` signal で画面を切り替える。
- `app.ts` が `@switch` で `ViewState.page` に応じてコンポーネントを表示。

### ViewState（画面一覧）
```typescript
type ViewState =
  | { page: 'landing' }               // LP（初期画面）
  | { page: 'login' }                 // ログイン
  | { page: 'register' }              // 会員登録
  | { page: 'character-list' }        // ウマ娘一覧
  | { page: 'character-regist' }      // ウマ娘登録
  | { page: 'race-list' }             // レース一覧
  | { page: 'remaining-race' }        // 残レース一覧
  | { page: 'remaining-race-pattern'; umamusumeId: number }; // 出走パターン
```

### 認証フロー
- 常にサイドバー + メインコンテンツを表示（未ログインでもアプリ全体が見える）
- サイドバー: `requiresLogin: true` の項目は未ログイン時グレーアウト + 🔒
- ログイン / 会員登録 / ログアウト ボタンはサイドバー下部に表示

### パスエイリアス（tsconfig.json）
```
@core/*  → src/app/core/*
@ui/*    → src/app/shared/*
@shared/* → ../shared/*（プロジェクトルートの shared/）
@env     → src/app/environments/environment
```

---

## バックエンド設計

### 認証
- グローバル `AuthGuard` が全エンドポイントで Cognito JWT を検証
- `@Public()` デコレーターを付けたエンドポイントは認証不要
- `@CurrentUser()` で Cognito の `sub`（ユーザーID）を取得

### 主要 API エンドポイント
```
GET  /umamusumes                    # 全ウマ娘一覧（認証不要）
GET  /umamusumes/unregistered       # 未登録ウマ娘一覧
GET  /umamusumes/registered         # 登録済みウマ娘一覧
POST /umamusumes/registrations      # ウマ娘登録

GET  /races                         # レース一覧（認証不要・フィルタあり）
GET  /races/registration-targets    # 登録対象レース一覧
GET  /races/remaining               # 残レース一覧
GET  /races/remaining/search        # 残レース検索
POST /races/run                     # 出走登録
POST /races/results                 # レース結果登録
POST /races/results/batch           # パターン一括登録
GET  /races/patterns/:umamusumeId   # 出走パターン候補取得
```

---

## DB スキーマ（主要テーブル）

- `umamusume_table` — ウマ娘マスタ（名前・適性情報）
- `race_table` — レースマスタ（レース名・馬場・距離・ランク・各シナリオ対応フラグ）
- `scenario_race_table` — ウマ娘ごとのシナリオレース定義
- `regist_umamusume_table` — ユーザーが登録したウマ娘
- `regist_umamusume_race_table` — 登録ウマ娘の出走済みレース

---

## コーディング規約

- コメントは **日本語**
- Angular: standalone コンポーネント・signal ベースのリアクティブ
- NestJS: ESM（`.js` 拡張子付きインポート）
- Tailwind: ユーティリティクラス直書き（CSS ファイル原則なし）
- 型は `shared/` に集約、フロント・バックで共有
- **JSDoc**: クラス・メソッド・公開プロパティに `/** 日本語説明 */` を付ける
  - メソッドには `@param` / `@returns` タグも記載
  - 単純な getter・signal の computed は省略可

---

## ビジネスロジック詳細

### 全冠の定義
- G1/G2/G3 合計 164 レース全てに出走すること
- 1育成で出走できるターンは最大 59（手動管理が困難なためシミュレーターが必要）
- 残レースが 0 になった状態 = 全冠達成（`patterns: []` を返す）

### シナリオ種別
| シナリオ | 概要 |
|---|---|
| BC（Breeder's Cup） | シニア11月前半に開催される9種のBCレースを最終レースとするパターン |
| ラーク（LARC） | ラーク関連レースを含むパターン |

### BC最終レース一覧（9種・全てシニア11月前半）
- BCターフ（芝・中距離）
- BCターフスプリント（芝・短距離）
- BCマイル（芝・マイル）
- BCスプリント（ダート・短距離）
- BCダートマイル（ダート・マイル）
- BCディスタフ（ダート・マイル）
- BCクラシック（ダート・中距離）
- BCフィリー&メア ターフ（芝・中距離）
- BCフィリー&メア スプリント（ダート・短距離）

### 出走パターン計算の9フェーズ（`backend/src/race/pattern/race-pattern.service.ts`）
| Phase | 処理内容 |
|---|---|
| 1 | 対象ウマ娘・出走済みレース・残レースデータを取得 |
| 2 | BC未出走レース数を集計しパターン生成数を決定 |
| 3 | BC数分のパターングリッドを初期化 |
| 4 | BCシナリオの中間レースを設定し、出走済みに追加・残レースから除外 |
| 5 | BC最終レースの適性を判断しパターンに設定（C未満→補修因子戦略A、C以上→戦略なし） |
| 6 | ジュニア7月頭から時系列で残レースを各パターンへ割り当て |
| 7 | Phase 6 後の残レースでオーバーフロー BC パターンを追加 |
| 8 | ラークレースが残レースに存在すれば、ラークパターンを追加 |
| 9 | 各パターン後処理（因子計算・主馬場距離集計・totalRaces集計） |

---

## マスタデータ追加手順

### ファイル構成

| ファイル | 内容 | 追加タイミング |
|---|---|---|
| `backend/data/Umamusume.json` | ウマ娘名・10種適性 | キャラ実装前（適性が判明した時点） |
| `backend/data/UmamusumeScenario.json` | シナリオレース定義（キャラ名をキー） | クラシックシナリオ実装時 |
| `backend/data/Race.json` | レースマスタ | 新規レース追加時 |

> **BCシナリオ・ラークシナリオはキャラ固有のシナリオレースが存在しないため、`UmamusumeScenario.json` への追加は不要。**
> クラシックシナリオ実装時のみ追加する。

---

### 新規ウマ娘を追加するとき
1. `backend/data/Umamusume.json` にエントリを追加
   - キー: ウマ娘名（文字列）
   - フィールド: `umamusume_name`・10種適性のみ（`scenarios` は不要）
2. 新規レースがある場合は `backend/data/Race.json` も追加
3. **DBスキーマ変更は不要**
4. デプロイ（またはサーバー再起動）で `SeedService.onModuleInit()` が自動検出・差分投入

```json
// Umamusume.json エントリ例
"ウマ娘名": {
    "umamusume_name": "ウマ娘名",
    "turf_aptitude": "A",
    "dirt_aptitude": "G",
    "front_runner_aptitude": "G",
    "early_foot_aptitude": "A",
    "midfield_aptitude": "A",
    "closer_aptitude": "C",
    "sprint_aptitude": "F",
    "mile_aptitude": "C",
    "classic_aptitude": "A",
    "long_distance_aptitude": "A"
}
```

### クラシックシナリオのシナリオレースを追加するとき
1. `backend/data/UmamusumeScenario.json` にウマ娘名をキーとしてエントリを追加
2. `SeedService` は新規ウマ娘の投入時のみシナリオレースを処理する

```json
// UmamusumeScenario.json エントリ例
"ウマ娘名": {
    "1": "きさらぎ賞",
    "2": "日本ダービー",
    "3": {"名前": "ジャパンカップ", "時期": "シニア"}
}
```

#### シナリオレースの記述形式
- 形式A: `"1": "きさらぎ賞"` — シンプル（レース名のみ）
- 形式B: `"2": {"名前": "ジャパンカップ", "時期": "シニア"}` — 時期指定あり（同名レースがクラシック・シニア両方にある場合）
- 形式C: `"3": {"1": "レースA", "2": "レースB"}` — ランダム選択グループ

### 新規レースを追加するとき
1. `backend/data/Race.json` に追加（キー: レース名）
2. 必要なフィールド: `race_name`, `race_state`, `distance`, `distance_detail`, `num_fans`,
   `race_rank`（G1=1/G2=2/G3=3）, `race_months`, `half_flag`,
   `junior_flag`, `classic_flag`, `senior_flag`, `larc_flag`, `bc_flag`

---

## 既知の制約・設計上の注意

- `frontend/src/app/core/guards/auth.guard.ts` は**意図的に未使用**。画面制御は `NavigationService` の signal で行う
- Angular Router は**意図的に未使用**。`ViewState` signal + `@switch` で画面切り替え
- ユーザーごとに同一ウマ娘は1頭のみ登録可（`RegistUmamusumeTable` の unique 制約）
- 同一レースを複数回出走登録不可（`RegistUmamusumeRaceTable` の unique 制約）
