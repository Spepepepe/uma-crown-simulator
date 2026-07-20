# Uma Crown Simulator - エラーハンドリング規約

このファイルを読んだ AI はバックエンドのエラーハンドリング規約を把握し、コード修正・レビュー・新規実装に適用してください。

関連規約: `prompt/coding-convention/backend/index.md` §3〜§9

---

## 目次

1. [フロントからの外部入力バリデーション](#1-フロントからの外部入力バリデーション)
2. [DB から取得したデータの検証](#2-db-から取得したデータの検証)
3. [外部 API データの検証](#3-外部-api-データの検証)

---

## 1. フロントからの外部入力バリデーション

`ValidationPipe`（→ `backend/index.md` §13）と DTO の `class-validator` デコレーターで検証する（→ `boilerplate.md` テンプレート参照）。

---

## 2. DB から取得したデータの検証

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

---

## 3. 外部 API データの検証

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
