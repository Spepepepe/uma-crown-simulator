# Uma Crown Simulator - テスト規約

このファイルを読んだ AI はバックエンドのテスト規約を把握し、コード修正・レビュー・新規実装に適用してください。

---

## 目次

1. [ファイルタイプ別テスト要否](#1-ファイルタイプ別テスト要否)
2. [ファイルタイプ別標準テストケース](#2-ファイルタイプ別標準テストケース)
3. [モック方針](#3-モック方針)
4. [テストファイルの配置](#4-テストファイルの配置)

---

## 1. ファイルタイプ別テスト要否

「不要」でも E2E テストでカバーされている場合がある。

| ファイルタイプ | テスト要否 | 理由 |
|---|---|---|
| `*.constant.ts` / `*.enum.ts` | **不要** | 定数・型定義のみ。TypeScript コンパイルで保証される |
| `*.exception.ts` | **必須** | プロパティ・デフォルト値の意図しない変更を検出する |
| `*.handler.ts` / `*.util.ts` | **必須** | 条件分岐ロジックがある純粋関数はテストが容易かつ効果が高い |
| `*.filter.ts` | **必須** | 例外種別の処理分岐・レスポンス形式変換を検証する |
| `*.service.ts`（複雑なロジック） | **必須** | ビジネスロジックのフェーズ・条件分岐の網羅 |
| `*.service.ts`（単純 CRUD のみ） | **不要** | Prisma のラッパーのみのメソッドは E2E テストで担保 |
| `*.mapper.ts` | **推奨** | null/undefined の扱い・フィールドマッピングのミスを早期検出 |
| `*.guard.ts` | **推奨** | 認証ロジックのバグは影響範囲が大きい |
| `*.controller.ts` | **不要** | E2E テストで担保 |
| `*.module.ts` | **不要** | NestJS の DI フレームワークを信頼する |

---

## 2. ファイルタイプ別標準テストケース

新規テストを書く際はこの「最低限のテストケース」を必ず含める。

### 2-1. `*.exception.ts`（カスタム例外クラス）

```typescript
describe('XxxException', () => {
  it('コンストラクタ引数がプロパティに正しく設定される', () => {
    const cause = new Error('原因');
    const err = new XxxException('メッセージ', 'Service.method', ErrorCode.DB_QUERY_FAILED, cause);
    expect(err.message).toBe('メッセージ');
    expect(err.location).toBe('Service.method');
    expect(err.errorCode).toBe(ErrorCode.DB_QUERY_FAILED);
    expect(err.cause).toBe(cause);
  });

  it('name が正しく設定される', () => {
    expect(new XxxException('msg', 'loc').name).toBe('XxxException');
  });

  it('domain が正しく設定される', () => {
    expect(new XxxException('msg', 'loc').domain).toBe('xxx');
  });

  it('errorCode のデフォルト値が適用される', () => {
    expect(new XxxException('msg', 'loc').errorCode).toBe(ErrorCode.DEFAULT_CODE);
  });
});
```

### 2-2. `*.handler.ts` / `*.util.ts`（純粋関数）

- 各条件分岐（switch / if）を 1 ケースずつ網羅する
- 正常系・異常系の両方を書く
- オプション引数がある場合は「省略時のデフォルト値」も検証する

```typescript
describe('handleXxx', () => {
  it('条件A の場合 → 期待する例外をスローする', () => {
    expect(() => handleXxx(inputA)).toThrow(ExpectedExceptionA);
  });

  it('オプション指定がある場合 → カスタム値が使われる', () => {
    expect(() => handleXxx(inputA, { customMessage: 'カスタム' }))
      .toThrow(expect.objectContaining({ message: 'カスタム' }));
  });
});
```

### 2-3. `*.filter.ts`（例外フィルター）

- 処理対象の例外タイプをすべて 1 ケースずつ検証する
- `response.status()` / `response.json()` の呼び出しを検証する
- ログレベル（`warn` / `error`）が適切か検証する

```typescript
describe('XxxFilter', () => {
  it('HttpException → 元のステータスコードと errorCode で返す', () => {
    filter.catch(new HttpException(...), host);
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'VALIDATION_001' }),
    );
  });

  it('未知の例外 → 500 + INTERNAL_001 で返す', () => {
    filter.catch(new Error('予期しないエラー'), host);
    expect(mockStatus).toHaveBeenCalledWith(500);
  });
});
```

### 2-4. `*.service.ts`（複雑なビジネスロジック）

- 正常系の主要なコードパスを 1 ケース以上
- 例外スローのトリガーとなる条件を 1 ケース以上
- DB モックは実際の Prisma 型と一致させる（型不一致によるテスト通過 → 本番失敗を防ぐ）

### 2-5. `*.mapper.ts`（マッパー関数）

- null フィールドが正しく `null` で返ること（`undefined` にならないこと）
- すべての必須フィールドがマッピングされること

### 2-6. エッジケースチェックリスト

標準テストケースに加え、以下のエッジケースも該当する場合に追加すること。

| カテゴリ | チェック項目 | 対象ファイルタイプ |
|---|---|---|
| 配列入力 | `ValidationPipe` が返す `message: string[]` を正しく処理できるか | `*.filter.ts` |
| null / undefined 入力 | `null` や `undefined` を受け取っても `DatabaseException` にフォールバックするか | `*.handler.ts` |
| cause の省略 | `cause` を省略したとき `undefined` になるか（`null` でないこと） | `*.exception.ts` |
| オプション引数の省略 | オプション引数を省略したときデフォルト値が使われるか | `*.handler.ts` |
| 同一タイプの異なる入力 | 同一 Prisma エラータイプでもコードが異なれば別の例外に変換されるか | `*.handler.ts` |

#### `*.filter.ts` — ValidationPipe の string[] メッセージ

`ValidationPipe` は `message` フィールドを `string[]` で返す。フィルターはこれを '; ' で結合して単一文字列にする。

```typescript
it('ValidationPipe が返す message: string[] → "; " 結合で返す', () => {
  filter.catch(
    new HttpException({ message: ['必須項目です', '最大長を超えています'], statusCode: 400 }, 400),
    host,
  );
  expect(mockJson).toHaveBeenCalledWith(
    expect.objectContaining({ message: '必須項目です; 最大長を超えています' }),
  );
});
```

#### `*.handler.ts` — null / undefined 入力

`handlePrismaError` に `null` や `undefined` を渡しても `DatabaseException` にフォールバックすること。

```typescript
it('null を渡した場合 → DatabaseException をスローする', () => {
  expect(() => handlePrismaError(null, 'Service.method')).toThrow(DatabaseException);
});

it('undefined を渡した場合 → DatabaseException をスローする', () => {
  expect(() => handlePrismaError(undefined, 'Service.method')).toThrow(DatabaseException);
});
```

---

## 3. モック方針

### PinoLogger のモック

```typescript
const mockLogger: any = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
```

`nestjs-pino` 全体のモックは `test/unit/__mocks__/nestjs-pino.ts` に集約されており、
`jest.config` の `moduleNameMapper` で自動適用される。

### Prisma のモック

```typescript
const mockPrisma = {
  raceTable: {
    findMany: jest.fn().mockResolvedValue([
      // 実際の RaceTable 型と一致させる（型不一致によるテスト通過 → 本番失敗を防ぐ）
      { race_id: 1, race_name: 'ジャパンカップ', race_rank: 1, race_state: 0, distance: 3 },
    ]),
  },
};
```

### Prisma エラーのモック

`handlePrismaError` 等を通じた Prisma エラーのハンドリングテストには、
実際の `Prisma.PrismaClientKnownRequestError` コンストラクタを使う。

```typescript
import { Prisma } from '@prisma/client';

const makeKnownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('test', { code, clientVersion: '6.0.0' });
```

### ArgumentsHost（ExceptionFilter テスト用）のモック

レスポンスは `.status(xxx).json({...})` とチェーンするため以下のように構成する。

```typescript
import { ArgumentsHost } from '@nestjs/common';

const mockJson = jest.fn();
const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
const mockResponse = { status: mockStatus };

function makeHost(): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => mockResponse,
    }),
  } as unknown as ArgumentsHost;
}
```

---

## 4. テストファイルの配置

```
backend/
└── test/
    ├── unit/
    │   ├── __mocks__/
    │   │   └── nestjs-pino.ts              # nestjs-pino グローバルモック
    │   ├── common/
    │   │   ├── exceptions/
    │   │   │   ├── database.exception.spec.ts
    │   │   │   ├── external-api.exception.spec.ts
    │   │   │   └── business-logic.exception.spec.ts
    │   │   ├── filters/
    │   │   │   └── all-exceptions.filter.spec.ts
    │   │   ├── guards/
    │   │   │   └── auth.guard.spec.ts
    │   │   └── utils/
    │   │       └── prisma-error.handler.spec.ts
    │   ├── race/
    │   │   └── ...
    │   └── umamusume/
    │       └── ...
    └── e2e/
        └── ...                             # E2E テスト（controller 層を担保）
```

- ユニットテストは `test/unit/<ソースの相対パス>.spec.ts` に配置する
- ファイル名は `<対象ファイル名>.spec.ts`
- E2E テストは `backend/test/e2e/` 配下
