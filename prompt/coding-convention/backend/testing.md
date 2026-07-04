# Uma Crown Simulator - テスト規約

このファイルを読ん�� AI はバックエンドのテスト規約を把握し、コード修正・レビュー・新規実装に適用してください。

---

## 目次

1. [ユニットテストの対象](#1-ユニットテ��トの対象)
2. [モック方針](#2-モック方針)
3. [テストファイルの配置](#3-テストファイルの配置)

---

## 1. ユニットテストの対象

- **必須**: 複雑なビジネスロジック（`race-pattern.service.ts` の各フェーズ・カスタム例外・バリデ��ション）
- **対象外**: 単純な CRUD（Prisma のラッパーのみのメソッド）

---

## 2. モック方針

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

---

## 3. テストファイルの配置

- バックエンド: テスト対象ファイルと同ディレクトリに `*.spec.ts`
- E2E テスト: `backend/test/` 配下
