# Uma Crown Simulator - ログ規約

このファイルを読んだ AI はバックエンドのログ規約を��握し、コード修正・レビュー・新規実���に適用してください。

`nestjs-pino` の `PinoLogger` を使用する。`console.log` / `console.error` の使用を**禁止**する。

---

## 目次

1. [ログレベルの使い分け](#1-ログレベルの使い分け)
2. [ログ JSON スキーマ（固定）](#2-ログ-json-スキーマ固定)
3. [ログ禁止情報](#3-ログ禁止情報)
4. [データスキップ時の warn ログ](#4-データスキップ時の-warn-ログ)

---

## 1. ログレベルの使い分け

| レベル | 用途 | 例 |
|---|---|---|
| `logger.debug` | 開発時のみ必要な詳細情報 | 中間計算値・クエリパラメータ |
| `logger.log` | 通常の業務イベント | 登録完了・出走登録完了 |
| `logger.warn` | 異常ではないが注意が必要な状態 | 残レース 0 でのパターン計算 |
| `logger.error` | 処理の失敗・例外 | DB エラー・外部 API エラー |

---

## 2. ログ JSON スキーマ（固定）

以下のフィールド名を統一して使う。スペル違いを禁止する。

| フィールド | 型 | 説明 | 必須 |
|---|---|---|---|
| `err` | Error | エラーオブジェクト（スタックトレース含む） | error 時 |
| `domain` | string | `"database"` / `"external_api"` / `"application"` | error 時 |
| `location` | string | `"ClassName.methodName"` 形式 | error 時 |
| `errorCode` | string | エラーコード（→ `backend/index.md` §4） | error 時 |
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

---

## 3. ログ禁止情報

以下の情報はログに含めてはならない。

- パスワード・トークン・APIキー
- Cognito の `accessToken` / `refreshToken`
- リクエストボディ全体（バリデーション前のデータに PII が含まれる可能性がある）

---

## 4. データスキップ時の warn ログ

バッチ処理やデータ変換で、期待した値が見つからずレコードをスキップする場合は `logger.warn()` で対象キーとスキップ理由を出力すること。**サイレントスキップ（ログなしの `continue`）を禁止**する。

```typescript
// NG: サイレントスキップ（何がスキップされたか不明）
const raceId = raceMap.get(raceName);
if (!raceId) continue;

// OK: warn ログでスキップを記録
const raceId = raceMap.get(raceName);
if (!raceId) {
  this.logger.warn({ raceName }, 'レース名がマスタに存在しないためスキップしました');
  continue;
}
```
