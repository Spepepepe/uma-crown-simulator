# Uma Crown Simulator - TypeScript / ESM 言語規約

このファイルを読んだ AI は TypeScript 言語レベルのコーディング規約を把握し、コード修正・レビュー・新規実装に適用してください。

共通規約は `prompt/coding-convention/index.md` を参照。

---

## 目次

1. [ESM インポート（.js 拡張子）](#1-esm-インポートjs-拡張子)
2. [非同期処理パターン](#2-非同期処理パターン)

---

## 1. ESM インポート（.js 拡張子）

本プロジェクトのバックエンドは ESM モードで動作する（`package.json` の `"type": "module"`）。
相対インポートには必ず `.js` 拡張子を付けること。TypeScript コンパイラは `.ts` → `.js` に変換するが、import パスは書き換えないため、拡張子なしだとランタイムで `ERR_MODULE_NOT_FOUND` が発生する。

```typescript
// NG: 拡張子なし（ESM では解決できない）
import { RacePatternService } from './race-pattern.service';

// OK: .js 拡張子を付ける
import { RacePatternService } from './race-pattern.service.js';
```

- `@nestjs/*` や `node_modules` のパッケージインポートは拡張子不要（パッケージの `exports` フィールドで解決される）
- `tsconfig.json` の `paths` エイリアス（例: `@app/*`）経由のインポートも `.js` 拡張子を付ける

---

## 2. 非同期処理パターン

### 2-1. await 漏れ禁止

Promise を返す関数は必ず `await` すること。await しない呼び出し（fire-and-forget）は、エラーが `unhandled rejection` となりプロセスクラッシュや無音失敗の原因になる。

```typescript
// NG: fire-and-forget（await しない）
// → heavyProcess 内で例外が発生しても catch されず、エラーログも出ない
someMethod() {
  this.heavyProcess(); // Promise が宙に浮く
}

// OK: 必ず await する
async someMethod() {
  await this.heavyProcess();
}
```

**fire-and-forget とは**: 非同期処理を呼び出した後、その結果を待たずに次の処理へ進むパターン。「撃ちっぱなし」の意味で、呼び出し側は成功・失敗を関知しない。レスポンス速度のために意図的に使うケースもあるが、本プロジェクトでは原則禁止とする。

### 2-2. 独立した処理の並列化（Promise.all）

互いに依存しない複数の非同期処理は `Promise.all` で並列実行し、不要な直列待ちを避ける。

```typescript
// NG: 直列に待つ（独立した処理なのに不要に遅い）
const races = await this.getRaces(id);
const scenarios = await this.getScenarios(id);

// OK: 独立した処理は並列化
const [races, scenarios] = await Promise.all([
  this.getRaces(id),
  this.getScenarios(id),
]);
```

- 片方の結果がもう片方の引数に必要な場合は直列で書く（当然 `Promise.all` にしない）
- `Promise.all` はいずれか1つが reject すると全体が reject するため、個別にエラーハンドリングが必要な場合は `Promise.allSettled` を検討する
