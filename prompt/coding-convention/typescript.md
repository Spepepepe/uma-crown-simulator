# Uma Crown Simulator - TypeScript / ESM 言語規約

このファイルを読んだ AI は TypeScript 言語レベルのコーディング規約を把握し、コード修正・レビュー・新規実装に適用してください。

共通規約は `prompt/coding-convention/index.md` を参照。

---

## 目次

1. [ESM インポート（.js 拡張子）](#1-esm-インポートjs-拡張子)
2. [非同期処理パターン](#2-非同期処理パターン)
3. [型定義の配置](#3-型定義の配置)
4. [その他の言語ルール](#4-その他の言語ルール)

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

---

## 3. 型定義の配置

`interface` / `type` を「どのファイルに書くか」は、**その型のスコープ（どこから使われるか）と契約性**で判断する。「型はロジックではないから常にファイルを分ける」という考え方は**誤り**。

SRP（単一責任）の「責務」は *変更理由が1つか* であって、*ファイル内に型を書いてはいけない* ではない。**1ファイルの中だけで完結する型は、そのファイルのロジックを表現する一部**であり、外に出すと実装詳細を追うのに無駄なファイルジャンプが増え可読性が落ちる。

### 判断フロー

```
その型は…
├─ フロントにも返る／API 契約になる      → shared/dto/response/ に置く（backend/index.md §13）
├─ 同一モジュールの複数ファイルで使う    → <module>.types.ts に分離
└─ 1ファイル内だけで完結する実装詳細     → そのファイルにインラインで書く（分離しない）
```

### 配置ルール表

| 型のスコープ | 配置場所 | 例 |
|---|---|---|
| フロント・バック共通の API 契約 | `shared/dto/response/*.ts` | `RaceResponse`, `ErrorResponse` |
| 同一モジュール内の複数ファイルで共有 | `<module>.types.ts` | `race.types.ts` の `RaceRow` / `RaceSlotData`、`pattern.types.ts` の `FetchedRaceData` |
| 1ファイル内だけで使う実装詳細 | そのファイルにインライン | `seed.service.ts` の `RaceJsonEntry`（JSON パース形状）、`auth.guard.ts` の `AuthenticatedRequest` |

### 原則

- **分離が得なのは**「複数ファイルで共有する」「契約として安定させたい」「テストから型を import したい」場合に限る
- **1ファイル専用の型を外に出すのは過剰分割**。無駄なファイルとジャンプが増えるだけで利益がない
- インラインで書く型にも JSDoc（`/** 説明 */`）を付ける（→ `index.md` §2）
- 1ファイル専用だった型が2ファイル目から参照され始めたら、その時点で `<module>.types.ts` へ切り出す（早すぎる分離をしない）

---

## 4. その他の言語ルール

### 3-1. `parseInt()` には必ず基数（radix）を渡す

`parseInt` の第2引数を省略すると、文字列の先頭が `0x` の場合に16進数として解釈されるなど、意図しない動作が発生する。

```typescript
// NG: 基数省略
const num = parseInt(str);

// OK: 基数を明示
const num = parseInt(str, 10);
```

### 3-2. ファイル I/O は非同期 API を使う

`fs.readFileSync` 等の同期 API はイベントループをブロックするため、アプリケーションコードでの使用を**禁止**する。`node:fs/promises` の非同期 API を使うこと。

```typescript
// NG: 同期 I/O（イベントループをブロックする）
import * as fs from 'fs';
const data = fs.readFileSync('data.json', 'utf-8');

// OK: 非同期 I/O
import { readFile } from 'node:fs/promises';
const data = await readFile('data.json', 'utf-8');
```

**例外**: CLI ツールや起動時の1回限りの読み込みなど、ブロックが許容される場面では同期 API を使用可。その場合はコメントで理由を明記する。
