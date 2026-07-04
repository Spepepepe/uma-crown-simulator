# Uma Crown Simulator - Prisma（DB 層）規約

このファイルを読んだ AI は Prisma ORM に関する DB 層の規約を把握し、コード修正・レビュー・新規実装に適用してください。

関連規約:
- `prompt/coding-convention/backend/index.md` — NestJS アプリケーション層規約
- `prompt/coding-convention/backend/error.md` — エラーハンドリング規約

---

## 目次

1. [Prisma エラー種別ハンドリング](#1-prisma-エラー種別ハンドリング)
2. [select / include 方針](#2-select--include-方針)
3. [N+1クエリ防止](#3-n1クエリ防止)
4. [トランザクション](#4-トランザクション)

---

## 1. Prisma エラー種別ハンドリング

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

---

## 2. select / include 方針

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

---

## 3. N+1クエリ防止

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

---

## 4. トランザクション

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
