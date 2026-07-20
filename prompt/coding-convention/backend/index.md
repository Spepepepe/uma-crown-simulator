# Uma Crown Simulator - バックエンド規約（NestJS アプリケーション層）

このファイルを読んだ AI はバックエンド固有の NestJS フレームワーク規約を把握し、コード修正・レビュー・新規実装に適用してください。
新規ファイルを作成する際は必ず `backend/boilerplate.md` を参照してから実装すること。

関連規約:
- `prompt/coding-convention/index.md` — 共通規約
- `prompt/coding-convention/typescript.md` — TypeScript / ESM 言語ルール
- `prompt/coding-convention/backend/prisma.md` — Prisma（DB 層）規約
- `prompt/coding-convention/backend/error.md` — エラーハンドリング規約
- `prompt/coding-convention/backend/logging.md` — ログ規約
- `prompt/coding-convention/backend/testing.md` — テスト規約
- `prompt/coding-convention/backend/boilerplate.md` — ボイラープレートテンプレート

---

## 目次

1. [ConfigService](#1-configservice)
2. [Correlation ID（nestjs-pino reqId）](#2-correlation-idnestjs-pino-reqid)
3. [エラーレスポンス形式（固定）](#3-エラーレスポンス形式固定)
4. [エラーコード体系](#4-エラーコード体系)
5. [カスタム例外クラス](#5-カスタム例外クラス)
6. [AllExceptionsFilter](#6-allexceptionsfilter)
7. [Operational Error vs Programmer Error](#7-operational-error-vs-programmer-error)
8. [エラー伝播ルール](#8-エラー伝播ルール)
9. [HTTP ステータスコードの判断基準](#9-http-ステータスコードの判断基準)
10. [成功レスポンスの形式](#10-成功レスポンスの形式)
11. [@Public() 使用基準](#11-public-使用基準)
12. [ValidationPipe グローバル設定](#12-validationpipe-グローバル設定)
13. [Response DTO（Prisma 型の直接返却禁止）](#13-response-dtoprisma-型の直接返却禁止)
14. [横断処理の使い分け（Guard / Interceptor / Middleware / Filter）](#14-横断処理の使い分けguard--interceptor--middleware--filter)
15. [Module 登録パターン](#15-module-登録パターン)

---

## 1. ConfigService

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

### 定数 vs ConfigService の使い分け

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

---

## 2. Correlation ID（nestjs-pino reqId）

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

---

## 3. エラーレスポンス形式（固定）

フロントへ返すすべてのエラーレスポンスを以下の形式に統一する。

```typescript
// shared/dto/response/error.response.ts
export interface ErrorResponse {
  statusCode: number;
  errorCode: string;   // エラーコード（→ §4）
  message: string;     // ユーザー向けメッセージ（日本語）
}
```

```json
{ "statusCode": 400, "errorCode": "VALIDATION_001", "message": "入力値が不正です" }
{ "statusCode": 500, "errorCode": "DB_001", "message": "サーバーエラーが発生しました" }
```

---

## 4. エラーコード体系

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

---

## 5. カスタム例外クラス

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

---

## 6. AllExceptionsFilter

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

---

## 7. Operational Error vs Programmer Error

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

---

## 8. エラー伝播ルール

- **Controller**: try-catch しない。例外はそのまま Filter に伝播させる
- **Service**: Prisma エラーをキャッチし `DatabaseException` に変換してから rethrow する（→ `prisma.md` §1）
- **Service（ビジネスロジック）**: 条件分岐で `NotFoundException` / `ConflictException` / `BusinessLogicException` をスロー
- **catch して握り潰しは禁止**。必ず rethrow か変換後 rethrow する

```typescript
// Controller - try-catch しない
@Get(':id/patterns')
async getPatterns(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: string) {
  return this.racePatternService.getPatterns(id, user);
}

// Service - Prisma エラーを変換して rethrow（.catch() 方式に統一）
async findRacesByUmamusume(umamusumeId: number): Promise<RaceResponse[]> {
  // Prisma 呼び出しは .catch() で handlePrismaError に委譲する。
  // handlePrismaError は never を返すため rows は Prisma の戻り値型に正しく推論される
  // （let + try/catch だと rows が any に退化し no-unsafe-* エラーになるため使わない → boilerplate.md §1）。
  const rows = await this.prisma.raceTable
    .findMany({ where: { ... } })
    // Prisma エラー種別ごとに適切な例外に変換する（→ prisma.md §1）
    .catch((err: unknown) => handlePrismaError(err, 'RaceService.findRacesByUmamusume'));
  rows.forEach((r) => this.validateRaceData(r));
  // Response DTO に変換（→ §13）
  return rows.map(toRaceResponse);
}
```

> **Prisma 呼び出しの標準形は `.catch()` インライン**（→ `boilerplate.md` §1）。値を使わない create/update/delete も含め、`let rows; try/catch` は使わない。

---

## 9. HTTP ステータスコードの判断基準

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

---

## 10. 成功レスポンスの形式

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

---

## 11. @Public() 使用基準

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

---

## 12. ValidationPipe グローバル設定

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
- `class-validator` デコレーターを必ず付ける（→ `boilerplate.md` テンプレート参照）

---

## 13. Response DTO（Prisma 型の直接返却禁止）

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

---

## 14. 横断処理の使い分け（Guard / Interceptor / Middleware / Filter）

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

---

## 15. Module 登録パターン

他モジュールの Service を使う場合は、Service を直接 `providers` に書かず、**モジュールごと `imports`** する。
モジュールは Service インスタンスの管理者であり、import することで同一インスタンスを共有できる。

```typescript
// NG: 他モジュールの Service を直接 providers に書く
// → 別インスタンスが生成され、依存解決にも失敗する
@Module({
  providers: [RacePatternService],
})
export class AnotherModule {}

// OK: モジュールごと import する
// → RaceModule が管理する同一インスタンスを共有できる
@Module({
  imports: [RaceModule],
})
export class AnotherModule {}
```

### 登録ルール

| `@Module()` フィールド | 登録すべきもの |
|---|---|
| `providers` | 自モジュール内で定義した Service / Guard / Interceptor / カスタム Provider |
| `imports` | 他モジュールの Service を使いたい場合、そのモジュール自体 |
| `exports` | 他モジュールから DI で使わせたい Service |

### 直接 providers に書いた場合の問題

| 問題 | 説明 |
|---|---|
| インスタンス重複 | 別インスタンスが生成され、状態が共有されない |
| 依存解決エラー | Service のコンストラクタ引数（依存先）が解決できずランタイムエラー |
| 変更伝播 | Service の依存が増減するたびに、直接登録した全モジュールに影響する |

### `@Global()` の使用基準

- `ConfigModule`・`LoggerModule` など**全モジュールで確実に使う**ものだけに限定する
- 安易に `@Global()` を付けると依存関係が不透明になるため、原則は明示的な `imports` を使う

---

## 16. シードデータ投入

アプリ起動時に JSON ファイルからマスタデータを DB へ投入するシード処理のルール。

### 16-1. JSON データの型定義

JSON ファイルから読み込むデータには **interface を定義**すること。`Record<string, any>` や `any[]` の使用を**禁止**する。

```typescript
// NG: any で受ける
const raw = JSON.parse(data) as Record<string, any>;

// OK: 型定義を用意
interface RaceJsonEntry {
  race_state: number;
  distance: number;
  // ...
}
const raw: Record<string, RaceJsonEntry> = JSON.parse(data);
```

### 16-2. JSON パース・ファイル読み込みのエラーハンドリング

ファイル読み込みや JSON パースに失敗した場合は `DatabaseException` でラップしてスローする。起動時に確実に検出させるため、握り潰しを禁止する。

```typescript
let raw: Record<string, RaceJsonEntry>;
try {
  const data = await readFile(dataPath, 'utf-8');
  raw = JSON.parse(data);
} catch (err) {
  throw new DatabaseException(
    `シードデータの読み込みに失敗しました: ${dataPath}`,
    'SeedService.upsertRaces',
    ErrorCode.DB_DATA_INTEGRITY,
    err,
  );
}
```
