# Uma Crown Simulator - フロントエンド規約（Angular）

このファイルを読んだ AI はフロントエンド固有のコーディング規約を把握し、コード修正・レビュー・新規実装に適用してください。

関連規約:
- `prompts/coding-convention/index.md` — 共通規約
- `prompts/coding-convention/typescript.md` — TypeScript / ESM 言語ルール

---

## 目次

1. [コンポーネント設計](#1-コンポーネント設計)
2. [Lint・品質ゲート](#2-lint品質ゲート)
3. [HTTP 通信・エラーハンドリング](#3-http-通信エラーハンドリング)

---

## 1. コンポーネント設計

- **standalone コンポーネント**を使用する（NgModule 不使用）
- リアクティブ値は `signal` / `computed` / `effect` を優先する
- テンプレートでは `@if` / `@for` / `@switch` を使う（`*ngIf` / `*ngFor` は禁止）

---

## 2. Lint・品質ゲート

ESLint（`angular-eslint` + `typescript-eslint`）で静的解析を実施する。

| 指標 | 閾値 | 備考 |
|---|---|---|
| 循環的複雑度 | **≤ 10** | ESLint `complexity` ルールで強制 |
| ネスト深度 | **≤ 4** | ESLint `max-depth` ルールで強制 |
| カバレッジ（branches / functions / lines / statements） | **90%** | Vitest + `@vitest/coverage-v8` で計測 |

- 設定ファイル: `frontend/eslint.config.mjs`、`frontend/vitest.config.ts`
- CI で lint → テスト（カバレッジ付き）の順に実行される
- `npm run lint` でローカル実行可能

---

## 3. HTTP 通信・エラーハンドリング

- サービスクラスが API 呼び出しを担い、コンポーネントは signal 経由でデータを参照する
- バックエンドの `ErrorResponse` 型を使ってエラーを処理する

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
