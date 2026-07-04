# Uma Crown Simulator - コーディング規約（共通）

このファイルを読んだ AI はプロジェクト全体の共通コーディング規約を把握し、コード修正・レビュー・新規実装に適用してください。

## 規約ファイル構成

| ファイル | 内容 |
|---|---|
| `prompt/coding-convention/index.md`（本ファイル） | 共通規約・JSDoc 規約 |
| `prompt/coding-convention/typescript.md` | TypeScript / ESM 言語ルール |
| `prompt/coding-convention/backend/index.md` | NestJS アプリケーション層規約 |
| `prompt/coding-convention/backend/prisma.md` | Prisma（DB 層）規約 |
| `prompt/coding-convention/backend/error.md` | エラーハンドリング規約 |
| `prompt/coding-convention/backend/logging.md` | ログ規約 |
| `prompt/coding-convention/backend/testing.md` | テスト規約 |
| `prompt/coding-convention/backend/boilerplate.md` | ボイラープレートテンプレート・ディレクトリ配置 |
| `prompt/coding-convention/frontend/index.md` | Angular フロントエンド規約 |

---

## 目次

1. [共通規約](#1-共通規約)
2. [JSDoc 規約](#2-jsdoc-規約)

---

## 1. 共通規約

### 1-1. 言語・コメント

- コメント・JSDoc・ログメッセージ・エラーメッセージは **日本語** で記述する
- 英語を使うのは識別子（変数名・関数名・クラス名）のみ

### 1-2. 命名規則

| 対象 | ケース | 例 |
|---|---|---|
| ファイル名 | kebab-case | `race-pattern.service.ts` |
| クラス・インターフェース | PascalCase | `RacePatternService` |
| 関数・変数 | camelCase | `getRemainingRaces` |
| 定数（モジュールスコープ） | UPPER_SNAKE_CASE | `MAX_RACE_COUNT` |
| enum メンバー | PascalCase | `RaceState.Turf` |

### 1-3. 型安全性

- `any` の使用を**禁止**する。`unknown` を使い、型ガードで絞り込む
- `as` キャストは最小限にし、型ガード関数または Zod スキーマで代替する
- 外部入力（リクエストボディ・DB取得値・外部API返却値）は必ず型検証する

```typescript
// NG
const data = response as SomeType;

// OK
function isSomeType(v: unknown): v is SomeType {
  return typeof v === 'object' && v !== null && 'field' in v;
}
```

### 1-4. 環境変数管理

- `process.env.XXX` の直接アクセスを**禁止**する
- バックエンド: `ConfigService` 経由でのみアクセスする
- フロントエンド: `environment.ts` 経由でのみアクセスする

### 1-5. shared 型の変更ルール

- `shared/` の型を変更するときはフロントエンド・バックエンド両方の影響を確認してからマージする
- 既存フィールドの削除・型変更は破壊的変更のため、まず optional にして段階的に移行する

### 1-6. プロジェクト横断命名パターン

ケース規則（§1-2）に加え、以下のパターンをプロジェクト全体で統一する。

#### ソースコード

| 用途 | パターン | 例 | 備考 |
|---|---|---|---|
| Mapper 関数 | `to*Response` | `toRaceResponse(row)` | `*.mapper.ts` に配置 |
| DB 取得結果（複数） | `rows` | `const rows = await this.prisma.raceTable.findMany()` | `data` / `result` / `items` は使わない |
| DB 取得結果（単数） | `row` | `const row = await this.prisma.raceTable.findUnique()` | `record` / `item` は使わない |
| catch 変数 | `err` | `catch (err)` | `error` / `e` / `ex` は使わない |

#### ドメイン用語

| 層 | 用語 | 理由 |
|---|---|---|
| DB（Prisma モデル） | `regist`（`registUmamusumeTable` 等） | DB スキーマ由来の短縮形。変更不可 |
| API パス・メソッド名 | `registration` / `registered` | ユーザー向けの正式な英語表現を使う |

### 1-7. Anti-patterns（禁止事項）

以下は一切書いてはならない。コードレビューで必ず指摘すること。

| 禁止パターン | 理由 |
|---|---|
| `process.env.XXX` 直接アクセス | 起動時検証ができず、設定漏れが実行時まで発覚しない |
| `console.log` / `console.error` | Pino の構造化ログが使えなくなる |
| `any` 型 | 型安全性が失われ、ランタイムエラーが増える |
| Prisma モデル型をそのまま return | DB スキーマ変更が即 API breaking change になる |
| `try { } catch(e) { }` で握り潰し | エラーが無音で消えてデバッグ不能になる |
| `as SomeType` キャスト（型ガードなし） | 実行時型不一致が検出されない |
| `@Public()` を安易に付与 | 意図せず認証をバイパスする |
| 設定値をモジュールスコープの `const` で定義 | 環境差異が吸収できず、変更時にコードを修正する必要が生じる |
| ログに password / token / PII を含める | セキュリティインシデントになる |
| `select` と `include` の混在 | Prisma がエラーを出す |
| レスポンスに `undefined` フィールドを含める | JSON シリアライズ時に無音で省略される |

---

## 2. JSDoc 規約

クラス・メソッド・公開プロパティすべてに JSDoc を付ける。

### 2-1. ファイル責務宣言（Single Responsibility）

クラス JSDoc に **担当** と **禁止** を記載し、「このファイルに書いてよいこと・書いてはいけないこと」を宣言する。

#### 記載基準

| ケース | 担当・禁止の記載 |
|---|---|
| フレームワークが役割を規定する標準ファイル（Controller / Service / Guard / Filter / Pipe / DTO） | **省略可** — 責務はフレームワーク規約から自明 |
| 責務が曖昧・複雑なファイル（複雑な計算ロジック・複数サービスが協調・ユーティリティ） | **必須** — 責務の逸脱を防ぐために明記する |

```typescript
// 省略可: フレームワークが役割を規定する標準ファイル
@Controller('races')
export class RaceController { ... }

// 必須: 責務が曖昧・複雑なファイル
/**
 * 出走パターン計算サービス
 *
 * 担当: 全冠出走パターンの計算ロジック（9フェーズ）
 * 禁止: HTTP の知識・直接レスポンス生成・Controller への依存
 */
@Injectable()
export class RacePatternService { ... }
```

#### ファイルタイプ別の標準責務定義（参考）

以下はフレームワーク規約から導かれる各ファイルの責務範囲。コードレビュー時の逸脱チェックに使用する。

| ファイルタイプ | 担当 | 禁止 |
|---|---|---|
| `*.controller.ts` | エンドポイント定義・HTTP I/O・パラメータ取得 | ビジネスロジック・DB アクセス・try-catch |
| `*.service.ts` | ビジネスロジック・オーケストレーション・Prisma 操作 | HTTP の知識（req/res/statusCode）・直接レスポンス生成 |
| `*.mapper.ts` | Prisma モデル → Response DTO への型変換 | ロジック・副作用・DB アクセス・例外スロー |
| `create-*.dto.ts` | リクエスト型定義・入力バリデーションデコレーター | メソッド実装・ロジック |
| `*.response.ts` | レスポンス型定義（インターフェースのみ） | メソッド実装・ロジック |
| `*.exception.ts` | エラー情報の保持（domain / location / errorCode） | ログ出力・HTTP 処理・ビジネスロジック |
| `*.filter.ts` | 例外のキャッチ・レスポンス形式への変換・ログ出力 | ビジネスロジック・DB アクセス |
| `*.guard.ts` | 認証・認可チェック | ビジネスロジック |
| `*.handler.ts` / `*.util.ts` | 単一の横断的処理（例: Prisma エラー変換） | 複数の関心事の混在 |

### 2-2. JSDoc 記述ルール

- **クラス**: 担当・禁止 + 責務の概要を1〜2文で記述する（→ §2-1）
- **メソッド**: 処理概要 + `@param` + `@returns` + 例外時は `@throws`
- **省略可**: 単純な getter・signal の computed・private ヘルパー（処理が自明なもの）

### 2-3. JSDoc フォーマットルール

| パターン | フォーマット | 例 |
|---|---|---|
| 説明のみ（1行で収まる） | `/** 説明 */` | `/** モジュール初期化時にDB接続を確立する */` |
| 説明 + `@param` / `@returns` あり | 説明を `/**` の次の行に書く | 下記参照 |

`@param` / `@returns` / `@throws` がある場合、説明文を `/**` と同じ行に書くことを**禁止**する。

```typescript
// NG: 説明と @param が混在する行
/** CognitoのIDトークンを検証する
 * @param token - JWT文字列
 * @returns ユーザーID
 */

// OK: 説明を次の行に分ける
/**
 * CognitoのIDトークンを検証する
 * @param token - JWT文字列
 * @returns ユーザーID
 */
```

### 2-4. バックエンド例

```typescript
/**
 * 出走パターン計算サービス
 *
 * 担当: 全冠出走パターンの計算ロジック（9フェーズ）
 * 禁止: HTTP の知識・直接レスポンス生成・Controller への依存
 *
 * 登録ウマ娘の残レースを取得し、全冠達成に向けた出走候補パターンを生成する。
 * BCシナリオ・ラークシナリオ・オーバーフローパターンを含む9フェーズで計算する。
 */
@Injectable()
export class RacePatternService {
  /**
   * 指定ウマ娘の出走パターン一覧を返す
   * @param umamusumeId - 登録ウマ娘 ID
   * @param userId - Cognito ユーザー ID（データ所有者確認に使用）
   * @returns 出走パターン配列。残レース 0 の場合は空配列
   * @throws NotFoundException 指定ウマ娘が見つからない場合
   * @throws DatabaseException DB 取得・検証に失敗した場合
   */
  async getPatterns(umamusumeId: number, userId: string): Promise<RacePatternResponse[]> {
    // ...
  }
}
```

### 2-5. フロントエンド例

```typescript
/**
 * レース API 呼び出しサービス
 *
 * 担当: バックエンド /races エンドポイントの呼び出しと Observable の提供
 * 禁止: UI ロジック・signal の直接操作・DOM 操作
 *
 * バックエンドの `/races` エンドポイント群をラップし、
 * コンポーネントに Observable を提供する。
 */
@Injectable({ providedIn: 'root' })
export class RaceService {
  /**
   * 残レース一覧を取得する
   * @param umamusumeId - 対象ウマ娘 ID
   * @returns 残レース配列の Observable
   */
  getRemainingRaces(umamusumeId: number): Observable<RemainingRaceResponse[]> {
    // ...
  }
}
```
