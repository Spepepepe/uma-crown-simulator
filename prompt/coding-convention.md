# Uma Crown Simulator - コーディング規約

このファイルを読んだ AI はプロジェクト全体のコーディング規約を把握し、コード修正・レビュー・新規実装に適用してください。
新規ファイルを作成する際は必ず §8「ボイラープレートテンプレート」を参照してから実装すること。

---

## 目次

1. [共通規約](#1-共通規約)
2. [JSDoc 規約](#2-jsdoc-規約)
3. [バックエンド規約（NestJS）](#3-バックエンド規約nestjs)
4. [フロントエンド規約（Angular）](#4-フロントエンド規約angular)
5. [エラーハンドリング規約](#5-エラーハンドリング規約)
6. [ログ規約](#6-ログ規約)
7. [テスト規約](#7-テスト規約)
8. [ボイラープレートテンプレート](#8-ボイラープレートテンプレート)

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
- 外部入力（リクエストボディ・DB取得値・外部API返却値）は必ず型検証する（→ §5）

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
- バックエンド: `ConfigService` 経由でのみアクセスする（→ §3-1）
- フロントエンド: `environment.ts` 経由でのみアクセスする

### 1-5. shared 型の変更ルール

- `shared/` の型を変更するときはフロントエンド・バックエンド両方の影響を確認してからマージする
- 既存フィールドの削除・型変更は破壊的変更のため、まず optional にして段階的に移行する

### 1-6. Anti-patterns（禁止事項）

以下は一切書いてはならない。コードレビューで必ず指摘すること。

| 禁止パターン | 理由 |
|---|---|
| `process.env.XXX` 直接アクセス | 起動時検証ができず、設定漏れが実行時まで発覚しない |
| `console.log` / `console.error` | Pino の構造化ログが使えなくなる |
| `any` 型 | 型安全性が失われ、ランタイムエラーが増える |
| Prisma モデル型をそのまま return | DB スキーマ変更が即 API breaking change になる |
| `try { } catch(e) { }` で握り潰し | エラーが無音で消えてデバッグ不能になる |
| `as SomeType` キャスト（型ガードなし） | 実行時型不一致が検出されない |
| `@Public()` を安易に付与 | 意図せず認証をバイパスする（→ §3-12） |
| 設定値をモジュールスコープの `const` で定義 | 環境差異が吸収できず、変更時にコードを修正する必要が生じる（→ §3-1） |
| ログに password / token / PII を含める | セキュリティインシデントになる |
| `select` と `include` の混在 | Prisma がエラーを出す（→ §3-15） |
| レスポンスに `undefined` フィールドを含める | JSON シリアライズ時に無音で省略される（→ §3-14） |

---

## 2. JSDoc 規約

クラス・メソッド・公開プロパティすべてに JSDoc を付ける。

### 2-1. ファイル責務宣言（Single Responsibility）

各ファイルのクラス JSDoc に **担当** と **禁止** を必ず明記する。
「このファイルに書いてよいこと・書いてはいけないこと」を宣言することで、責務の逸脱を防ぐ。

```typescript
/**
 * RaceController
 *
 * 担当: HTTP リクエスト受付・パラメータのバインディング・レスポンス返却
 * 禁止: ビジネスロジック・DB 直接アクセス・try-catch・認証処理
 */
@Controller('races')
export class RaceController { ... }
```

**ファイルタイプ別の標準責務定義**（各ファイルはこの範囲を守る）:

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

### 2-3. バックエンド例

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

### 2-4. フロントエンド例

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

---

## 3. バックエンド規約（NestJS）

### 3-1. ConfigService

環境変数および環境ごとに変わりうる設定値は `ConfigService` をコンストラクタで注入して取得する。
モジュールスコープの定数やグローバル変数として定義することを**禁止**する。

```typescript
// app.module.ts
ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

// サービス内
@Injectable()
export class SomeService {
  constructor(private readonly config: ConfigService) {}

  private getDbUrl(): string {
    // 値が未定義なら起動時に例外を発生させる
    return this.config.getOrThrow<string>('DATABASE_URL');
  }
}
```

- **`getOrThrow`** を使い、未定義時に起動時点で即座に例外を発生させる
- `config.get` を使う場合は `?? throwMissing(key)` パターンか明示的な undefined チェックを付ける

#### 定数 vs ConfigService の使い分け

「環境やデプロイ設定によって変わりうる値か」で判断する。

| 種別 | 定義場所 | 例 |
|---|---|---|
| **ドメイン定数**（ビジネスルールで決まる不変の値） | `const` でファイル内定義 OK | 全冠レース数 `164`、BCレース数 `9` |
| **設定値**（環境・デプロイで変わりうる値） | ConfigService 経由で注入 | タイムアウト秒数、外部API URL、最大リトライ数 |

```typescript
// NG: 設定値をモジュールスコープの定数に書く
const API_TIMEOUT_MS = 5000;
const COGNITO_REGION = 'ap-northeast-1';

// OK: ConfigService 経由でコンストラクタに注入する
@Injectable()
export class CognitoService {
  private readonly region: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.region = this.config.getOrThrow<string>('COGNITO_REGION');
    this.timeoutMs = this.config.get<number>('API_TIMEOUT_MS') ?? 5000;
  }
}

// OK: ビジネスルールの不変定数はファイル内 const で定義してよい
const TOTAL_CROWN_RACES = 164;
const MAX_RACE_TURNS = 59;
```

### 3-2. Correlation ID（nestjs-pino reqId）

nestjs-pino（pino-http）の組み込み `reqId` 機能を使う。全ログに自動でリクエスト ID が付与される。

```typescript
// app.module.ts の LoggerModule 設定
import { randomUUID } from 'crypto';

LoggerModule.forRoot({
  pinoHttp: {
    // フロントから X-Correlation-Id を受け取るか、なければ UUID を生成
    genReqId: (req) =>
      (req.headers['x-correlation-id'] as string) ?? randomUUID(),
    // リクエスト完了時の自動ログ
    customSuccessMessage: (req, res) =>
      `${req.method} ${req.url} → ${res.statusCode}`,
    customErrorMessage: (req, res) =>
      `${req.method} ${req.url} → ${res.statusCode} エラー`,
    // 本番では debug を除外
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
}),
```

これにより `reqId` はすべてのログに自動付与される。手動で `reqId` を渡す必要はない。

### 3-3. エラーレスポンス形式（固定）

フロントへ返すすべてのエラーレスポンスを以下の形式に統一する。

```typescript
// shared/dto/response/error.response.ts
export interface ErrorResponse {
  statusCode: number;
  errorCode: string;   // エラーコード（→ §3-4）
  message: string;     // ユーザー向けメッセージ（日本語）
}
```

```json
{ "statusCode": 400, "errorCode": "VALIDATION_001", "message": "入力値が不正です" }
{ "statusCode": 500, "errorCode": "DB_001", "message": "サーバーエラーが発生しました" }
```

### 3-4. エラーコード体系

エラーコードは `CATEGORY_NNN` 形式で定義する。

| カテゴリ | コード範囲 | HTTP ステータス | 用途 |
|---|---|---|---|
| `VALIDATION` | 001〜 | 400 | リクエストバリデーションエラー |
| `AUTH` | 001〜 | 401/403 | 認証・認可エラー |
| `NOT_FOUND` | 001〜 | 404 | リソース未存在 |
| `CONFLICT` | 001〜 | 409 | 重複・競合 |
| `DB` | 001〜 | 500 | DB 操作エラー |
| `EXTERNAL` | 001〜 | 500 | 外部 API エラー |
| `INTERNAL` | 001〜 | 500 | その他内部エラー |

```typescript
// backend/src/common/constants/error-code.constant.ts
export const ErrorCode = {
  // バリデーション
  VALIDATION_INVALID_INPUT: 'VALIDATION_001',
  // リソース未存在
  NOT_FOUND_UMAMUSUME: 'NOT_FOUND_001',
  NOT_FOUND_RACE: 'NOT_FOUND_002',
  // 競合
  CONFLICT_UMAMUSUME_ALREADY_REGISTERED: 'CONFLICT_001',
  CONFLICT_RACE_ALREADY_RUN: 'CONFLICT_002',
  // DB
  DB_QUERY_FAILED: 'DB_001',
  DB_DATA_INTEGRITY: 'DB_002',
  // 外部API
  EXTERNAL_API_FAILED: 'EXTERNAL_001',
  EXTERNAL_API_INVALID_RESPONSE: 'EXTERNAL_002',
  // 内部
  INTERNAL_UNKNOWN: 'INTERNAL_001',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
```

**新規エラーコードの追加ルール**: 既存のカテゴリに該当する場合は連番を振る。新カテゴリが必要な場合はこのファイルにカテゴリを追加してから定義する。

### 3-5. カスタム例外クラス

`backend/src/common/exceptions/` 配下に配置する。

```typescript
// database.exception.ts
export class DatabaseException extends Error {
  readonly domain = 'database' as const;
  constructor(
    message: string,
    readonly location: string,   // 'ClassName.methodName' 形式
    readonly errorCode: string = ErrorCode.DB_QUERY_FAILED,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DatabaseException';
  }
}

// external-api.exception.ts
export class ExternalApiException extends Error {
  readonly domain = 'external_api' as const;
  constructor(
    message: string,
    readonly location: string,
    readonly errorCode: string = ErrorCode.EXTERNAL_API_FAILED,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ExternalApiException';
  }
}

// business-logic.exception.ts
export class BusinessLogicException extends Error {
  readonly domain = 'application' as const;
  constructor(
    message: string,
    readonly location: string,
    readonly errorCode: string = ErrorCode.INTERNAL_UNKNOWN,
    readonly httpStatus: number = HttpStatus.BAD_REQUEST,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'BusinessLogicException';
  }
}
```

### 3-6. AllExceptionsFilter

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(AllExceptionsFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Operational Error（予測可能な失敗）
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as Record<string, unknown>)['message'] as string) ?? exception.message;
      const errorCode =
        typeof body === 'object'
          ? ((body as Record<string, unknown>)['errorCode'] as string) ?? 'HTTP_ERROR'
          : 'HTTP_ERROR';
      response.status(status).json({ statusCode: status, errorCode, message });
      return;
    }

    // BusinessLogicException
    if (exception instanceof BusinessLogicException) {
      this.logger.warn(
        { domain: exception.domain, location: exception.location },
        `[${exception.domain}] ${exception.location}: ${exception.message}`,
      );
      response.status(exception.httpStatus).json({
        statusCode: exception.httpStatus,
        errorCode: exception.errorCode,
        message: exception.message,
      });
      return;
    }

    // Programmer Error（予期しない失敗）→ 詳細を内部ログに記録し、クライアントには一律 500
    const domain =
      exception instanceof DatabaseException ? exception.domain
      : exception instanceof ExternalApiException ? exception.domain
      : 'application';

    const location =
      exception instanceof DatabaseException || exception instanceof ExternalApiException
        ? exception.location
        : '不明';

    const errorCode =
      exception instanceof DatabaseException ? exception.errorCode
      : exception instanceof ExternalApiException ? exception.errorCode
      : ErrorCode.INTERNAL_UNKNOWN;

    this.logger.error(
      { err: exception, domain, location },
      `[${domain}] ${location} で未ハンドルの例外が発生しました`,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode,
      message: 'サーバーエラーが発生しました',
    });
  }
}
```

### 3-7. Operational Error vs Programmer Error

| 種別 | 例 | 対応 |
|---|---|---|
| **Operational Error** | バリデーション NG・重複登録・リソース未存在 | `HttpException` または `BusinessLogicException` をスロー、warn ログ |
| **Programmer Error** | null 参照・DB 接続失敗・外部 API 応答不正 | `DatabaseException` / `ExternalApiException` をスロー、error ログ |

```typescript
// Operational Error（NestJS 組み込み例外を使う）
if (!umamusume) {
  throw new NotFoundException({
    errorCode: ErrorCode.NOT_FOUND_UMAMUSUME,
    message: '指定されたウマ娘が見つかりません',
  });
}

// Programmer Error（カスタム例外を使う）
try {
  return await this.prisma.raceTable.findMany();
} catch (err) {
  throw new DatabaseException(
    'レース一覧の取得に失敗しました',
    'RaceService.findAll',
    ErrorCode.DB_QUERY_FAILED,
    err,
  );
}
```

### 3-8. エラー伝播ルール

- **Controller**: try-catch しない。例外はそのまま Filter に伝播させる
- **Service**: Prisma エラーをキャッチし `DatabaseException` に変換してから rethrow する（→ §3-9）
- **Service（ビジネスロジック）**: 条件分岐で `NotFoundException` / `ConflictException` / `BusinessLogicException` をスロー
- **catch して握り潰しは禁止**。必ず rethrow か変換後 rethrow する

```typescript
// Controller - try-catch しない
@Get(':id/patterns')
async getPatterns(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: string) {
  return this.racePatternService.getPatterns(id, user);
}

// Service - Prisma エラーを変換して rethrow
async findRacesByUmamusume(umamusumeId: number): Promise<RaceResponse[]> {
  let rows: RaceTable[];
  try {
    rows = await this.prisma.raceTable.findMany({ where: { ... } });
  } catch (err) {
    // Prisma エラー種別ごとに適切な例外に変換する（→ §3-9）
    handlePrismaError(err, 'RaceService.findRacesByUmamusume');
  }
  rows.forEach((r) => this.validateRaceData(r));
  // Response DTO に変換（→ §3-14）
  return rows.map(toRaceResponse);
}
```

### 3-9. Prisma エラー種別ハンドリング

Prisma の `PrismaClientKnownRequestError` をそのまま投げず、必ず意味のある例外に変換する。
変換処理は共通ユーティリティ関数 `handlePrismaError` に集約する。

```typescript
// backend/src/common/utils/prisma-error.handler.ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseException } from '../exceptions/database.exception.js';
import { ErrorCode } from '../constants/error-code.constant.js';

/**
 * Prisma エラーを適切な HTTP 例外またはカスタム例外に変換してスローする
 * @param err - キャッチした例外
 * @param location - 発生箇所（'ClassName.methodName' 形式）
 * @param options - エラーコードのオーバーライド
 * @throws ConflictException P2002（ユニーク制約違反）の場合
 * @throws NotFoundException P2025（レコード未存在）の場合
 * @throws DatabaseException その他の Prisma エラーの場合
 */
export function handlePrismaError(
  err: unknown,
  location: string,
  options?: {
    conflictErrorCode?: string;
    notFoundErrorCode?: string;
    conflictMessage?: string;
    notFoundMessage?: string;
  },
): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': // ユニーク制約違反
        throw new ConflictException({
          errorCode: options?.conflictErrorCode ?? ErrorCode.CONFLICT_UMAMUSUME_ALREADY_REGISTERED,
          message: options?.conflictMessage ?? '既に登録されています',
        });
      case 'P2025': // レコード未存在
        throw new NotFoundException({
          errorCode: options?.notFoundErrorCode ?? ErrorCode.NOT_FOUND_UMAMUSUME,
          message: options?.notFoundMessage ?? '指定されたデータが見つかりません',
        });
    }
  }
  throw new DatabaseException('DB 操作に失敗しました', location, ErrorCode.DB_QUERY_FAILED, err);
}
```

**主要な Prisma エラーコード一覧**:

| コード | 意味 | 変換先 |
|---|---|---|
| `P2002` | ユニーク制約違反（重複登録） | `ConflictException` (409) |
| `P2025` | レコードが見つからない | `NotFoundException` (404) |
| `P2003` | 外部キー制約違反 | `DatabaseException` (500) |
| その他 | 予期しない DB エラー | `DatabaseException` (500) |

### 3-10. HTTP ステータスコードの判断基準

AI が判断に迷わないよう、ケースごとのルールを明示する。

| ケース | ステータス | 実装 |
|---|---|---|
| 一覧取得で 0 件 | **200** + `[]` | 空配列をそのまま return（404 にしない） |
| ID 指定で未存在 | **404** | `NotFoundException` をスロー |
| 入力バリデーション NG | **400** | `ValidationPipe` が自動処理 |
| 重複登録・競合 | **409** | `ConflictException` をスロー |
| 認証トークン無効・未送信 | **401** | `AuthGuard` が自動処理 |
| 認証済みだが権限なし | **403** | `ForbiddenException` をスロー |
| サーバー内部エラー | **500** | カスタム例外 → `AllExceptionsFilter` が処理 |

### 3-11. 成功レスポンスの形式

このプロジェクトはページネーションなし。一覧は**配列をそのまま**返す。ラッパーオブジェクトは使わない。

```typescript
// OK: 配列そのまま（このプロジェクトの標準）
@Get()
async findAll(): Promise<RaceResponse[]> {
  return this.raceService.findAll();
}

// NG: ラッパーオブジェクトは使わない
@Get()
async findAll(): Promise<{ data: RaceResponse[]; total: number }> { ... }

// OK: 単体リソース
@Get(':id')
async findOne(@Param('id', ParseIntPipe) id: number): Promise<RaceResponse> {
  return this.raceService.findOne(id);
}

// OK: 作成・更新 → 作成/更新後のリソースを返す
@Post()
async create(@Body() dto: CreateRaceDto): Promise<RaceResponse> {
  return this.raceService.create(dto);
}

// OK: 削除 → void（ボディなし）
@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)
async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
  return this.raceService.remove(id);
}
```

### 3-12. @Public() 使用基準

`@Public()` を付けてよいのは以下の条件をすべて満たす場合のみ。

**許可条件**:
1. HTTP メソッドが `GET`（参照系のみ）
2. ユーザー固有データを含まない（`user_id` で絞り込まないマスタデータ）
3. `@Public()` の直上に認証不要の理由をコメントで記述する

```typescript
// OK: マスタデータの一覧取得
@Public()  // 認証不要: 全ウマ娘一覧は未ログインユーザーも参照可能なマスタデータ
@Get()
async findAll(): Promise<UmamusumeResponse[]> { ... }

// NG: ユーザー固有データへの @Public() は禁止
@Public()  // ← 禁止（user_id で絞り込むデータに @Public() を付けてはならない）
@Get('registered')
async findRegistered(@CurrentUser() userId: string): Promise<UmamusumeResponse[]> { ... }

// NG: POST への @Public() は原則禁止
@Public()  // ← 禁止
@Post()
async create(@Body() dto: CreateDto): Promise<Response> { ... }
```

### 3-13. ValidationPipe グローバル設定

```typescript
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,             // DTO に存在しないフィールドを除去
    forbidNonWhitelisted: true,  // 余分フィールドを 400 エラーにする
    transform: true,             // リクエスト値を DTO 型に変換する
  }),
);
```

- DTO は `backend/src/<module>/dto/` 配下に配置する
- `class-validator` デコレーターを必ず付ける（→ §8 テンプレート参照）

### 3-14. Response DTO（Prisma 型の直接返却禁止）

Prisma モデル型をコントローラーから直接 return することを**禁止**する。

```typescript
// NG: Prisma 型がそのまま API に露出する
async getRaces(): Promise<RaceTable[]> { ... }

// OK: Response DTO に変換して返す
async getRaces(): Promise<RaceResponse[]> {
  const rows = await this.prisma.raceTable.findMany();
  return rows.map(toRaceResponse);
}
```

- Response DTO は `shared/dto/response/` 配下に定義する（フロントと共有）
- 変換関数（`toXxxResponse`）はサービスと同じディレクトリの `xxx.mapper.ts` に配置する

**null / undefined のルール**:

- Prisma が返す `null` はそのまま Response DTO でも `null` として定義する
- `undefined` はレスポンス JSON に含まれないため、API フィールドに `undefined` を使うことを**禁止**する

```typescript
// OK: null を型に含める
export interface RaceResponse {
  raceId: number;
  raceName: string;
  description: string | null;  // DB が null の場合もある
}

// NG: undefined を使う（JSON に含まれず、フロントで存在チェックが必要になる）
export interface RaceResponse {
  raceId: number;
  raceName: string;
  description?: string;  // undefined は JSON.stringify で省略される
}

// Mapper での null 扱い
export function toRaceResponse(row: RaceTable): RaceResponse {
  return {
    raceId: row.race_id,
    raceName: row.race_name,
    description: row.description,  // null のまま渡す（undefined に変換しない）
  };
}
```

フロント側での参照:

```typescript
// null チェックを明示的に行う
const desc = race.description ?? '説明なし';
```

### 3-15. Prisma の select / include 方針

**基本方針: 全フィールド取得 → Mapper で除外**

- 通常の CRUD は `select` 指定なしで全フィールドを取得し、Mapper で不要フィールドを除外する
- DB から余分なフィールドを取得してもセキュリティ上の問題はない（Mapper で除外される）
- `select` と `include` の混在は**禁止**（Prisma がコンパイルエラーを出す）

```typescript
// OK: 全フィールド取得 → Mapper で変換（基本パターン）
const races = await this.prisma.raceTable.findMany();
return races.map(toRaceResponse);

// OK: リレーション取得は include を使う
const race = await this.prisma.raceTable.findUnique({
  where: { race_id: id },
  include: { scenario_races: true },
});

// OK: パフォーマンス上の理由で select を使う場合はコメントで理由を記載
// レコード数が多く全フィールド取得がボトルネックになるため select で絞り込む
const names = await this.prisma.raceTable.findMany({
  select: { race_id: true, race_name: true },
});

// NG: select と include の混在（Prisma がエラーを出す）
const race = await this.prisma.raceTable.findUnique({
  where: { race_id: id },
  select: { race_id: true },
  include: { scenario_races: true },
});
```

### 3-16. N+1クエリ防止

ループ内で Prisma クエリを発行することを**禁止**する。関連データは `include` で一括取得する。

```typescript
// NG: N+1（ウマ娘数 × レース数のクエリが発行される）
const list = await this.prisma.registUmamusumeTable.findMany();
for (const uma of list) {
  const races = await this.prisma.registUmamusumeRaceTable.findMany({
    where: { regist_umamusume_id: uma.regist_umamusume_id },
  });
}

// OK: include で JOIN し1クエリにまとめる
const list = await this.prisma.registUmamusumeTable.findMany({
  include: { regist_umamusume_race_tables: true },
});
```

**N+1 を検出する方法（開発時）**:

```typescript
// prisma.service.ts に query イベントログを追加して発行クエリ数を確認する
this.prisma.$on('query', (e) => {
  this.logger.debug({ query: e.query, duration: e.duration }, 'Prisma クエリ');
});
```

**include のネスト深さ**:
- 2階層まで: `include` で対応
- 3階層以上が必要な場合: クエリを分割するか設計を見直す（深いネストはパフォーマンス劣化のサイン）

### 3-17. 横断処理の使い分け（Guard / Interceptor / Middleware / Filter）

NestJS のリクエストライフサイクル順:

```
Middleware → Guard → Interceptor（前） → Pipe → Controller → Interceptor（後） → Filter
```

| 種別 | 担当 | 具体的な用途 |
|---|---|---|
| **Middleware** | Express レベルの前処理 | CORS・リクエストロギング・ヘルメット |
| **Guard** | リクエストを通すか遮断するかの判断 | JWT 認証・ロールチェック |
| **Interceptor** | リクエスト/レスポンスの前後処理 | 処理時間計測・レスポンス変換・キャッシュ |
| **Pipe** | パラメータの変換・バリデーション | `ParseIntPipe`・`ValidationPipe` |
| **Filter** | 例外のキャッチとレスポンス形式変換 | `AllExceptionsFilter` |

**判断フロー**:

```
Q1. リクエストを通すか遮断するか判断したい → Guard
Q2. リクエスト前後で何か処理したい（ログ・計測・変換） → Interceptor
Q3. Express レベルで全リクエストに処理したい → Middleware
Q4. 例外をキャッチしてレスポンスに変換したい → Filter
```

```typescript
// Guard: 認証チェック（通す/遮断）
@Injectable()
export class AuthGuard implements CanActivate {
  // 担当: JWT 検証・@Public() 判定
  // 禁止: ビジネスロジック・DB アクセス（認証情報の取得は除く）
  canActivate(context: ExecutionContext): boolean | Promise<boolean> { ... }
}

// Interceptor: 処理時間計測（前後処理）
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  // 担当: リクエスト開始・終了時間の計測とログ出力
  // 禁止: ビジネスロジック・認証処理
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    return next.handle().pipe(
      tap(() => this.logger.log({ durationMs: Date.now() - start }, 'リクエスト完了')),
    );
  }
}
```

### 3-18. Prisma トランザクション

複数テーブルを更新する処理は `$transaction` で原子性を保証する。

```typescript
// NG: 個別更新（途中失敗で不整合が発生する）
await this.prisma.registUmamusumeTable.create({ data: umaData });
await this.prisma.registUmamusumeRaceTable.createMany({ data: raceData });

// OK: トランザクションで一括
await this.prisma.$transaction([
  this.prisma.registUmamusumeTable.create({ data: umaData }),
  this.prisma.registUmamusumeRaceTable.createMany({ data: raceData }),
]);
```

---

## 4. フロントエンド規約（Angular）

### 4-1. コンポーネント設計

- **standalone コンポーネント**を使用する（NgModule 不使用）
- リアクティブ値は `signal` / `computed` / `effect` を優先する
- テンプレートでは `@if` / `@for` / `@switch` を使う（`*ngIf` / `*ngFor` は禁止）

### 4-2. HTTP 通信・エラーハンドリング

- サービスクラスが API 呼び出しを担い、コンポーネントは signal 経由でデータを参照する
- バックエンドの `ErrorResponse` 型（§3-3）を使ってエラーを処理する

```typescript
getRemainingRaces(id: number): Observable<RemainingRaceResponse[]> {
  return this.http.get<RemainingRaceResponse[]>(`/races/remaining?umamusumeId=${id}`).pipe(
    catchError((err: HttpErrorResponse) => {
      const error = err.error as ErrorResponse;
      this.logger.error(`残レース取得エラー: [${error.errorCode}] ${error.message}`);
      return throwError(() => err);
    }),
  );
}
```

---

## 5. エラーハンドリング規約

### 5-A. フロントからの外部入力バリデーション

`ValidationPipe`（→ §3-13）と DTO の `class-validator` デコレーターで検証する（→ §8-3 テンプレート参照）。

### 5-B. DB から取得したデータの検証

ビジネスロジックで DB データを使う前に、必須フィールドと値の範囲を検証する。

```typescript
/**
 * レースデータの必須フィールドと値域を検証する
 * @param race - 検証対象のレースデータ
 * @throws DatabaseException フィールド欠落またはランク不正の場合
 */
private validateRaceData(race: RaceTable): void {
  if (!race.race_name || !race.race_state || !race.distance_detail) {
    throw new DatabaseException(
      `レースデータの必須フィールドが欠落しています (raceId: ${race.race_id})`,
      'RacePatternService.validateRaceData',
      ErrorCode.DB_DATA_INTEGRITY,
    );
  }
  if (race.race_rank < 1 || race.race_rank > 3) {
    throw new DatabaseException(
      `レースランクが不正です (raceId: ${race.race_id}, rank: ${race.race_rank})`,
      'RacePatternService.validateRaceData',
      ErrorCode.DB_DATA_INTEGRITY,
    );
  }
}
```

**検証タイミング**: DB から取得した直後・他のサービスに渡す直前

### 5-C. 外部 API データの検証

Zod スキーマで外部 API レスポンスを検証する。

```typescript
import { z } from 'zod';

const ExternalApiResponseSchema = z.object({
  id: z.string(),
  data: z.array(z.object({ /* ... */ })),
});

async fetchExternalData(): Promise<ExternalData> {
  const raw = await this.httpService.axiosRef.get(url).catch((err) => {
    throw new ExternalApiException(
      '外部 API への接続に失敗しました',
      'ExternalService.fetchExternalData',
      ErrorCode.EXTERNAL_API_FAILED,
      err,
    );
  });

  const parsed = ExternalApiResponseSchema.safeParse(raw.data);
  if (!parsed.success) {
    throw new ExternalApiException(
      '外部 API のレスポンス形式が不正です',
      'ExternalService.fetchExternalData',
      ErrorCode.EXTERNAL_API_INVALID_RESPONSE,
      parsed.error,
    );
  }
  return parsed.data;
}
```

---

## 6. ログ規約

`nestjs-pino` の `PinoLogger` を使用する。`console.log` / `console.error` の使用を**禁止**する。

### 6-1. ログレベルの使い分け

| レベル | 用途 | 例 |
|---|---|---|
| `logger.debug` | 開発時のみ必要な詳細情報 | 中間計算値・クエリパラメータ |
| `logger.log` | 通常の業務イベント | 登録完了・出走登録完了 |
| `logger.warn` | 異常ではないが注意が必要な状態 | 残レース 0 でのパターン計算 |
| `logger.error` | 処理の失敗・例外 | DB エラー・外部 API エラー |

### 6-2. ログ JSON スキーマ（固定）

以下のフィールド名を統一して使う。スペル違いを禁止する。

| フィールド | 型 | 説明 | 必須 |
|---|---|---|---|
| `err` | Error | エラーオブジェクト（スタックトレース含む） | error 時 |
| `domain` | string | `"database"` / `"external_api"` / `"application"` | error 時 |
| `location` | string | `"ClassName.methodName"` 形式 | error 時 |
| `errorCode` | string | §3-4 のエラーコード | error 時 |
| `userId` | string | Cognito sub（取得できる場合） | 任意 |
| `umamusumeId` | number | 操作対象ウマ娘 ID（あれば） | 任意 |

```typescript
// error ログ
this.logger.error(
  {
    err: exception,
    domain: 'database',
    location: 'RaceService.runRace',
    errorCode: ErrorCode.DB_QUERY_FAILED,
    userId,
    umamusumeId,
  },
  '[database] RaceService.runRace で DB 操作エラーが発生しました',
);

// 業務イベント（log）
this.logger.log({ umamusumeId }, 'ウマ娘の出走登録が完了しました');
```

### 6-3. ログ禁止情報

以下の情報はログに含めてはならない。

- パスワード・トークン・APIキー
- Cognito の `accessToken` / `refreshToken`
- リクエストボディ全体（バリデーション前のデータに PII が含まれる可能性がある）

---

## 7. テスト規約

### 7-1. ユニットテストの対象

- **必須**: 複雑なビジネスロジック（`race-pattern.service.ts` の各フェーズ・カスタム例外・バリデーション）
- **対象外**: 単純な CRUD（Prisma のラッパーのみのメソッド）

### 7-2. モック方針

```typescript
const mockPrisma = {
  raceTable: {
    findMany: jest.fn().mockResolvedValue([
      // 実際の RaceTable 型と一致させる（型不一致によるテスト通過 → 本番失敗を防ぐ）
      { race_id: 1, race_name: 'ジャパンカップ', race_rank: 1, race_state: '芝', distance_detail: '中距離' },
    ]),
  },
};
```

### 7-3. テストファイルの配置

- バックエンド: テスト対象ファイルと同ディレクトリに `*.spec.ts`
- E2E テスト: `backend/test/` 配下

---

## 8. ボイラープレートテンプレート

**新規ファイルを作成するときは必ずこのテンプレートから始める。**

### 8-1. Service テンプレート

```typescript
// backend/src/<module>/<module>.service.ts
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../prisma/prisma.service.js';
import { DatabaseException } from '../common/exceptions/database.exception.js';
import { ErrorCode } from '../common/constants/error-code.constant.js';
import { handlePrismaError } from '../common/utils/prisma-error.handler.js';
import { XxxResponse } from '../../shared/dto/response/xxx.response.js';
import { toXxxResponse } from './xxx.mapper.js';

/**
 * XXX サービス
 *
 * 担当: XXX のビジネスロジックと Prisma 操作
 * 禁止: HTTP の知識（req/res）・直接レスポンス生成・try-catch なしの Prisma 呼び出し
 *
 * （責務の概要を1〜2文で記述する）
 */
@Injectable()
export class XxxService {
  constructor(
    @InjectPinoLogger(XxxService.name)
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * XXX 一覧を返す
   * @param userId - Cognito ユーザー ID
   * @returns XXX 配列
   * @throws DatabaseException DB 取得に失敗した場合
   */
  async findAll(userId: string): Promise<XxxResponse[]> {
    let rows;
    try {
      rows = await this.prisma.xxxTable.findMany({ where: { user_id: userId } });
    } catch (err) {
      handlePrismaError(err, 'XxxService.findAll');
    }
    this.logger.log({ userId }, 'XXX 一覧を取得しました');
    return rows.map(toXxxResponse);
  }
}
```

### 8-2. Controller テンプレート

```typescript
// backend/src/<module>/<module>.controller.ts
import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { XxxService } from './xxx.service.js';
import { CreateXxxDto } from './dto/create-xxx.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { XxxResponse } from '../../shared/dto/response/xxx.response.js';

/**
 * XXX コントローラー
 *
 * 担当: /xxx エンドポイントの定義・HTTP I/O・パラメータのバインディング
 * 禁止: ビジネスロジック・DB アクセス・try-catch・認証処理
 */
@Controller('xxx')
export class XxxController {
  constructor(private readonly xxxService: XxxService) {}

  /**
   * XXX 一覧を取得する
   * @param userId - 認証済みユーザー ID
   * @returns XXX 配列
   */
  @Get()
  async findAll(@CurrentUser() userId: string): Promise<XxxResponse[]> {
    return this.xxxService.findAll(userId);
  }

  /**
   * XXX を作成する
   * @param dto - 作成リクエスト
   * @param userId - 認証済みユーザー ID
   * @returns 作成した XXX
   */
  @Post()
  async create(
    @Body() dto: CreateXxxDto,
    @CurrentUser() userId: string,
  ): Promise<XxxResponse> {
    return this.xxxService.create(dto, userId);
  }
}
```

### 8-3. Request DTO テンプレート

```typescript
// backend/src/<module>/dto/create-xxx.dto.ts
import { IsInt, IsString, Min, MaxLength, IsNotEmpty } from 'class-validator';

/**
 * XXX 作成リクエスト DTO
 */
export class CreateXxxDto {
  /** XXX ID */
  @IsInt()
  @Min(1)
  xxxId: number;

  /** XXX 名 */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  xxxName: string;
}
```

### 8-4. Response DTO テンプレート

```typescript
// shared/dto/response/xxx.response.ts

/**
 * XXX レスポンス DTO
 *
 * フロントエンド・バックエンド共通の型定義。
 * Prisma モデルを直接使わず、このインターフェースに変換して返す。
 * optional フィールドは undefined ではなく null を使う。
 */
export interface XxxResponse {
  xxxId: number;
  xxxName: string;
  description: string | null;  // optional フィールドは null で表現する
}
```

### 8-5. Mapper テンプレート

```typescript
// backend/src/<module>/xxx.mapper.ts
import { XxxTable } from '@prisma/client';
import { XxxResponse } from '../../shared/dto/response/xxx.response.js';

/**
 * Prisma モデルを Response DTO に変換する
 * @param row - Prisma から取得したレコード
 * @returns Response DTO
 */
export function toXxxResponse(row: XxxTable): XxxResponse {
  return {
    xxxId: row.xxx_id,
    xxxName: row.xxx_name,
    description: row.description,  // null のまま渡す（undefined に変換しない）
  };
}
```

### 8-6. カスタム例外の使用例

```typescript
// DatabaseException（DB 操作失敗）
throw new DatabaseException(
  'XXX の取得に失敗しました',       // ログ用日本語メッセージ
  'XxxService.methodName',          // 発生箇所 'ClassName.methodName' 形式
  ErrorCode.DB_QUERY_FAILED,        // §3-4 のエラーコード
  originalError,                    // 原因となった例外（スタックトレース保持）
);

// Prisma エラーは handlePrismaError を使う（→ §3-9）
try {
  await this.prisma.xxxTable.create({ data });
} catch (err) {
  handlePrismaError(err, 'XxxService.create', {
    conflictErrorCode: ErrorCode.CONFLICT_XXX_ALREADY_EXISTS,
    conflictMessage: 'XXX は既に登録されています',
  });
}
```

---

## 付録A: ディレクトリ配置ルール（バックエンド）

```
backend/src/
├── common/
│   ├── constants/
│   │   └── error-code.constant.ts      # エラーコード定義（§3-4）
│   ├── exceptions/
│   │   ├── database.exception.ts       # DB エラー（§3-5）
│   │   ├── external-api.exception.ts   # 外部 API エラー（§3-5）
│   │   └── business-logic.exception.ts # ビジネスロジックエラー（§3-5）
│   ├── utils/
│   │   └── prisma-error.handler.ts     # Prisma エラー変換ユーティリティ（§3-9）
│   ├── filters/
│   │   └── all-exceptions.filter.ts    # グローバル例外フィルター（§3-6）
│   ├── interceptors/
│   │   └── logging.interceptor.ts      # 処理時間計測など（§3-17）
│   ├── guards/
│   │   └── auth.guard.ts               # JWT 認証（§3-17）
│   └── decorators/
│       ├── current-user.decorator.ts
│       └── public.decorator.ts
└── <module>/
    ├── <module>.controller.ts
    ├── <module>.service.ts
    ├── <module>.mapper.ts              # Prisma → Response DTO 変換（§3-14）
    └── dto/
        ├── create-<module>.dto.ts      # Request DTO（§3-13）
        └── update-<module>.dto.ts

shared/
└── dto/
    └── response/
        ├── error.response.ts           # ErrorResponse 共通型（§3-3）
        ├── race.response.ts
        └── umamusume.response.ts
```
