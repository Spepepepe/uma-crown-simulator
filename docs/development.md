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

## テスト構成

```
backend/test/
├── unit/
│   ├── auth/auth.service.spec.ts
│   ├── common/guards/auth.guard.spec.ts
│   ├── race/
│   │   ├── race.service.spec.ts
│   │   ├── race-pattern.service.spec.ts       # DB モック + 実アルゴリズム
│   │   ├── race-pattern.scenarios.spec.ts     # BC残数×ラーク有無の組み合わせ
│   │   └── race-pattern.realdata.spec.ts      # 実 JSON データを使った結合テスト
│   └── umamusume/umamusume.service.spec.ts
└── e2e/
    ├── auth.e2e-spec.ts
    ├── race.e2e-spec.ts
    └── umamusume.e2e-spec.ts

frontend/test/unit/
├── core/
│   ├── guards/auth.guard.spec.ts
│   ├── interceptors/auth.interceptor.spec.ts
│   └── services/
│       ├── auth.service.spec.ts
│       ├── character.service.spec.ts
│       └── race.service.spec.ts
└── shared/
    ├── components/toast/toast.service.spec.ts
    └── utils/
        ├── race-formatter.spec.ts
        └── color-mapper.spec.ts
```

## テストシナリオ詳細

### バックエンド 単体テスト

#### `auth/auth.service.spec.ts`

対象: `src/auth/auth.service.ts`

| シナリオ | 検証内容 |
|---------|---------|
| `getUserData` — 正常ケース | 任意のユーザー ID を渡すと `{ user_id }` オブジェクトを返す |
| `getUserData` — 空文字 | 空文字の ID でも正しく動作する |

---

#### `common/guards/auth.guard.spec.ts`

対象: `src/common/guards/auth.guard.ts`

| シナリオ | 検証内容 |
|---------|---------|
| `@Public()` ルート | 認証ヘッダーなしでも `canActivate` が `true` を返し、Cognito 検証を呼ばない |
| 認証必須 — ヘッダーなし | `UnauthorizedException`（「認証トークンがありません」）をスローする |
| 認証必須 — `Bearer` プレフィックスなし | `UnauthorizedException` をスローする |
| 認証必須 — Cognito が `null` 返却 | `UnauthorizedException`（「無効なトークンです」）をスローする |
| 認証必須 — 有効トークン | `true` を返し `request.userId` にユーザー ID をセットする |

---

#### `race/race.service.spec.ts`

対象: `src/race/race.service.ts`

| メソッド | シナリオ | 検証内容 |
|---------|---------|---------|
| `getRaceList` | フィルタなし | `race_rank: { in: [1,2,3] }` のみで findMany を呼ぶ |
| `getRaceList` | 馬場フィルタ（芝） | `race_state: 0` を WHERE に追加して呼ぶ |
| `getRaceList` | 距離フィルタ（マイル） | `distance: 2` を WHERE に追加して呼ぶ |
| `getRaceList` | 複合フィルタ | 馬場・距離両方を WHERE に追加して呼ぶ |
| `getRegistRaceList` | 正常 | G1/G2/G3 レース一覧を返す |
| `getRemaining` | 登録ウマ娘なし | 空配列を返す |
| `getRemaining` | 全レース出走済み | `isAllCrown: true`、カウント 0 |
| `getRemaining` | 残レースあり | `isAllCrown: false`、馬場・距離カテゴリ別カウントが正確 |
| `getRemaining` | 複数ウマ娘 | `allCrownRace` 昇順でソートされる |
| `registerOne` | 出走済み | DB 作成をスキップし「既に出走済み」メッセージを返す |
| `registerOne` | 未出走 | レコードを作成し「出走登録しました」メッセージを返す |
| `registerOne` | `race_name` 省略 | レース ID をフォールバックラベルとして使う |
| `raceRun` | 正常 | `create` を呼び「出走完了」を返す |
| `registerPattern` | 複数レース | `createMany(skipDuplicates)` で一括登録する |
| `registerPattern` | 空配列 | `data: []` で `createMany` を呼ぶ |
| `getRemainingToRace` | 指定月に残レースあり | 該当スロットのレースと Props を返す |
| `getRemainingToRace` | 指定月に残レースなし | 次スロットを探索して空配列を返す |

---

#### `race/race-pattern.service.spec.ts`

対象: `src/race/pattern/race-pattern.service.ts`（DB モック + 実アルゴリズム）

| シナリオ | 検証内容 |
|---------|---------|
| 登録ウマ娘が存在しない | `InternalServerErrorException` をスローする |
| 全レース出走済み | `patterns` プロパティを持つ結果を返す（パターン 0 件は許容） |
| 残レースあり（BC最終レース含む） | パターン 1 件以上が生成され、各パターンに `scenario` / `junior` / `classic` / `senior` / `factors`（6 枠）/ `totalRaces` が揃う |
| シナリオレースあり | パターンが正常に生成される |

---

#### `race/race-pattern.scenarios.spec.ts`

対象: `src/race/pattern/race-pattern.service.ts`（BCシナリオ残レース数×ラーク有無の組み合わせ）

テスト対象ウマ娘 10 体 × BC残レース数 5 パターン（1/3/5/7/9 件）× ラーク残存あり/なし = 最大 **100 シナリオ**

| シナリオ軸 | 検証内容 |
|-----------|---------|
| BC残レース数 N + ラーク残存あり | `bcPatterns.length === N`、`larcPatterns.length === 1` |
| BC残レース数 N + ラーク残存なし | `bcPatterns.length === N`、`larcPatterns.length === 0` |
| 各パターン — 必須フィールド | `scenario` / `factors`（6 枠）/ `totalRaces > 0` が全パターンに揃う |
| 未出走レース全件収録（ラークあり） | 未出走の全 G1/G2/G3 レースがいずれかのパターンのスロットに含まれる |
| 未出走レース全件収録（ラークなし） | 同上 |

> BC中間レースは「実際のゲームプレイでは先に出走済み」という前提で出走済みに設定してモックを構築する。

---

#### `race/race-pattern.realdata.spec.ts`

対象: `src/race/pattern/race-pattern.service.ts`（実 JSON データを使った結合テスト）

テスト対象ウマ娘 7 体（スペシャルウィーク / ハルウララ / サクラバクシンオー / ホッコータルマエ / キングヘイロー / ジェンティルドンナ / アーモンドアイ）、全レース未走前提。

| シナリオ | 検証内容 |
|---------|---------|
| パターン生成がエラーなく完了する | 例外なく `getRacePattern` が解決する |
| 1 件以上のパターンが生成される | `patterns.length >= 1`、`umamusumeName` が正しい |
| 各パターンの必須フィールド | `scenario` / `factors`（6 枠）/ `totalRaces > 0` が全パターンに揃う |
| BC パターンに BC 最終レースが含まれる | BC パターンのいずれかのスロットに `bc_flag=true` のレースが配置されている |
| 適性 D 未満レースが通常割り当てに含まれない | 通常割り当てスロットの馬場・距離適性スコアが 0 以上（BC中間・BC最終・ラーク必須は除外） |

---

#### `umamusume/umamusume.service.spec.ts`

対象: `src/umamusume/umamusume.service.ts`

| メソッド | シナリオ | 検証内容 |
|---------|---------|---------|
| `findAll` | 正常 | `umamusume_id` 昇順で全ウマ娘を取得する |
| `findUnregistered` | 登録済みなし | フィルタなしで `findMany` を呼ぶ |
| `findUnregistered` | 登録済みあり | `umamusume_id: { notIn: [...] }` フィルタ付きで `findMany` を呼ぶ |
| `findRegistered` | 登録済みあり | `{ umamusume }` 形式にマッピングして返す |
| `findRegistered` | 登録済みなし | 空配列を返す |
| `register` | レース ID なし | `registUmamusumeTable.create` のみ呼ぶ |
| `register` | レース ID あり | `registUmamusumeTable.create` + `registUmamusumeRaceTable.createMany` を呼ぶ |

---

### バックエンド E2E テスト

#### `e2e/auth.e2e-spec.ts`

対象: `src/common/guards/auth.guard.ts`（実 NestJS アプリ + モック Cognito）

| シナリオ | 検証内容 |
|---------|---------|
| 認証必須エンドポイント — ヘッダーなし | 401 を返す |
| 認証必須エンドポイント — 無効トークン | 401 を返す |
| 認証必須エンドポイント — 有効トークン | 200 を返し、サービスに正しい `userId` が渡る |
| 認証必須エンドポイント — `Bearer` プレフィックスなし | 401 を返す |
| `@Public()` エンドポイント（`GET /races`） | 認証ヘッダーなしでも 200 を返す |

---

#### `e2e/race.e2e-spec.ts`

対象: `src/race/race.controller.ts`（実 NestJS アプリ + MockAuthGuard）

| エンドポイント | シナリオ | 検証内容 |
|--------------|---------|---------|
| `GET /races` | フィルタなし | 200、`getRaceList(-1, -1)` が呼ばれる |
| `GET /races` | `?state=0&distance=3` | `getRaceList(0, 3)` が呼ばれる |
| `GET /races/registration-targets` | 正常 | 200、`getRegistRaceList` が呼ばれる |
| `GET /races/remaining` | 正常 | 200、認証済み `userId` で `getRemaining` が呼ばれる |
| `GET /races/remaining/search` | クエリパラメータあり | 200、型変換済みパラメータでサービスが呼ばれる |
| `POST /races/run` | 正常 | 201、`raceRun(userId, umamusumeId, raceId)` が呼ばれる |
| `POST /races/results` | 正常 | 201、`registerOne(userId, umamusumeId, race)` が呼ばれる |
| `POST /races/results/batch` | 正常 | 201、`registerPattern(userId, umamusumeId, races)` が呼ばれる |
| `GET /races/patterns/:umamusumeId` | 正常 | 200、`getRacePattern(userId, 1)` が呼ばれる |

---

#### `e2e/umamusume.e2e-spec.ts`

対象: `src/umamusume/umamusume.controller.ts`（実 NestJS アプリ + MockAuthGuard）

| エンドポイント | シナリオ | 検証内容 |
|--------------|---------|---------|
| `GET /umamusumes` | 正常 | 200、`findAll` が呼ばれレスポンスを返す |
| `GET /umamusumes/unregistered` | 正常 | 200、認証済み `userId` で `findUnregistered` が呼ばれる |
| `GET /umamusumes/registered` | 正常 | 200、認証済み `userId` で `findRegistered` が呼ばれる |
| `POST /umamusumes/registrations` | `raceIdArray` あり | 201、正しい引数で `register` が呼ばれ登録メッセージを返す |
| `POST /umamusumes/registrations` | `raceIdArray` 空 | 201、空配列で `register` が呼ばれる |

---

### フロントエンド 単体テスト

#### `core/guards/auth.guard.spec.ts`

対象: `src/app/core/guards/auth.guard.ts`

| シナリオ | 検証内容 |
|---------|---------|
| ログイン済み | `true` を返してルートアクセスを許可する |
| 未ログイン | `UrlTree`（`/login` リダイレクト）を返す |

---

#### `core/interceptors/auth.interceptor.spec.ts`

対象: `src/app/core/interceptors/auth.interceptor.ts`

| シナリオ | 検証内容 |
|---------|---------|
| トークンあり | `Authorization: Bearer <token>` ヘッダーを付与してリクエストを渡す |
| トークンあり — 元リクエスト | クローンにヘッダーを付与し元のリクエストを変更しない |
| トークン `null` | ヘッダーを付与せず元のリクエストをそのまま渡す |
| `getToken` の呼び出し | リクエストごとに 1 回だけ呼ばれる |

---

#### `core/services/auth.service.spec.ts`

対象: `src/app/core/services/auth.service.ts`

| メソッド | シナリオ | 検証内容 |
|---------|---------|---------|
| 初期状態 | — | `token` が `null`、`isLoggedIn` が `false` |
| セッション復元 | Cognito にユーザーなし | トークンが設定されない |
| セッション復元 | セッション有効 | トークンが設定される |
| セッション復元 | セッション無効 | トークンが設定されない |
| `login` | 認証成功 | `success: true`、トークンが設定される |
| `login` | 認証失敗 | `success: false`、エラーメッセージを返す |
| `signUp` | 登録成功 | `success: true` を返す |
| `signUp` | 登録失敗 | `success: false`、エラーメッセージを返す |
| `confirmSignUp` | 確認成功 | `success: true` を返す |
| `confirmSignUp` | 確認失敗 | `success: false`、エラーメッセージを返す |
| `logout` | 正常 | `token` をクリアし `isLoggedIn` が `false` になる |
| `logout` | Cognito ユーザーなし | エラーなく完了する |
| `getToken` | ログイン前/後 | 前は `null`、後はトークン文字列を返す |

---

#### `core/services/character.service.spec.ts`

対象: `src/app/core/services/character.service.ts`

| メソッド | シナリオ | 検証内容 |
|---------|---------|---------|
| `getUnregisteredUmamusumes` | 正常 | 未登録ウマ娘一覧を返す |
| `getUnregisteredUmamusumes` | API エラー | エラーを伝播する |
| `getRegisteredUmamusumes` | 正常 | 登録済みウマ娘一覧を返す |
| `getRegisteredUmamusumes` | API エラー | エラーを伝播する |
| `registerCharacter` | 正常 | 正しいリクエストボディで POST する |
| `registerCharacter` | API エラー | エラーを伝播する |

---

#### `core/services/race.service.spec.ts`

対象: `src/app/core/services/race.service.ts`

| メソッド | シナリオ | 検証内容 |
|---------|---------|---------|
| `getRaces` | フィルタなし | レース一覧を取得する |
| `getRaces` | 馬場・距離フィルタあり | フィルタ付きで API を呼ぶ |
| `getRaces` | API エラー | エラーを伝播する |
| `getRegistrationTargets` | 正常 | 登録用レース一覧を取得する |
| `getRemainingRaces` | 正常 | 残レース情報の一覧を取得する |
| `getPatterns` | 正常 | 指定ウマ娘のパターンを取得する |
| `registerBatchResults` | 正常 | 全レースを一括登録する |
| `registerOneResult` | 正常 | 1 件のレースを登録する |
| `registerOneResult` | API エラー | エラーを伝播する |

---

#### `shared/components/toast/toast.service.spec.ts`

対象: `src/app/shared/components/toast/toast.service.ts`

| シナリオ | 検証内容 |
|---------|---------|
| 初期状態 | `isVisible: false`、`message: ''` |
| `show` — デフォルト | メッセージが設定され `isVisible: true`、`type: 'success'` |
| `show` — `type: error` | エラー種別を指定できる |
| `show` — 3 秒後 | `isVisible` が `false` になる（自動非表示） |
| `show` — 3 秒未満 | `isVisible` が `true` のまま |
| `show` — 連続呼び出し | タイマーがリセットされ再カウントが始まる |

---

#### `shared/utils/color-mapper.spec.ts`

対象: `src/app/shared/utils/color-mapper.ts`

| 関数 | 検証内容 |
|-----|---------|
| `gradeBg` | レースグレード（1=G1/2=G2/3=G3）をグラデーション背景クラスに変換する |
| `gradeBadge` | レースグレードをバッジスタイルクラスに変換する |
| `gradeColor` | 適性ランク（S〜G）をカラークラスに変換する |
| `getDistanceBgColor` | 距離区分（1〜4）を背景色クラスに変換する |
| `getSurfaceBgColor` | 馬場種別（0=芝/1=ダート）を背景色クラスに変換する |
| `getRaceCountClass` | 残レース数を色クラスに変換する（0=黄/全冠、1〜2=緑、3+=赤） |
| `getRaceCountDisplay` | 残レース数を表示文字列に変換する（0=👑、1+=数値） |

---

#### `shared/utils/race-formatter.spec.ts`

対象: `src/app/shared/utils/race-formatter.ts`

| 関数 | 検証内容 |
|-----|---------|
| `getRaceRank` | ランク ID（1〜3）を「GI / GII / GIII」文字列に変換する |
| `getDistanceLabel` | 距離区分（1〜4）を日本語ラベル（短距離/マイル/中距離/長距離）に変換する |
| `getRunSeason` | レースフラグ（`junior_flag` 等）の組み合わせからシーズン文字列（「ジュニア」「クラシック」「シニア」等）を生成する |

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

## モノレポ構成

npm workspaces を使用しています。

```json
// package.json
{
  "workspaces": ["frontend", "backend", "shared"]
}
```

共有型定義パッケージ `@uma-crown/shared` は `shared/` ディレクトリで管理し、
フロントエンド・バックエンド両方から参照します。
