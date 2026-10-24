# テストガイド

## テストケース一覧

| ドキュメント | 内容 |
|---|---|
| [test-cases-backend.md](test-cases-backend.md) | バックエンド（Jest）の単体・E2E テストケース一覧 |
| [test-cases-frontend.md](test-cases-frontend.md) | フロントエンド（Vitest）の単体テストケース一覧 |

## テスト方針: 分岐網羅

テストケースは **分岐網羅（ブランチカバレッジ）** を基準に設計します。

- `if` / `switch` / 三項演算子 / `??` / `?.` などの分岐ごとに、真・偽それぞれを通るケースを 1 件以上用意する
- 正常系だけでなく、例外・早期リターン・デフォルト値が使われる経路も 1 ケースとして数える
- テスト名は「条件 → 期待結果」の形式で書き、どの分岐を検証しているかを読み取れるようにする

## 品質ゲート

GitHub Actions（`.github/workflows/test.yml`）で develop への push、main・develop 向けの PR、main へのデプロイ前に計測し、閾値を下回るとジョブが失敗してマージがブロックされます。

| 指標 | バックエンド | フロントエンド |
|---|---:|---:|
| **Branches（分岐網羅・主指標）** | **80%** | **80%** |
| Functions | 90% | 90% |
| Lines | 90% | 90% |
| Statements | 90% | 90% |

- 閾値の定義場所: バックエンドは `backend/package.json` の `jest.coverageThreshold`、フロントエンドは `frontend/vitest.config.ts` の `coverage.thresholds`
- カバレッジ表は CI ログ（`Run tests with coverage` ステップ）に `text` 形式で出力される
- E2E テスト（`backend/test/e2e/`）はカバレッジ計測の対象外

## 現在のカバレッジ（2026-10-20 時点）

| 指標 | バックエンド | フロントエンド |
|---|---:|---:|
| Branches | 83.21% | 93.10% |
| Functions | 92.70% | 91.66% |
| Lines | 95.80% | 96.47% |
| Statements | 94.39% | 96.35% |

分岐網羅率の低いファイル（80% 未満）:

| ファイル | Branches |
|---|---:|
| `backend/src/race/pattern/larc-pattern-builder.service.ts` | 31.25% |
| `backend/src/common/cognito/cognito.service.ts` | 75.00% |
| `backend/src/race/pattern/bc-pattern-builder.service.ts` | 79.33% |
| `frontend/src/app/core/interceptors/auth.interceptor.ts` | 33.33% |

> フロントエンドのカバレッジは、テストから読み込まれたファイルだけが分母になります。
> spec のない画面コンポーネント等は計測に含まれていません（[test-cases-frontend.md](test-cases-frontend.md#テスト未作成のソース) を参照）。

## テストの実行

```bash
# バックエンド 単体テスト（カバレッジ付き）
npm --prefix backend run test:cov

# バックエンド E2E テスト
npm --prefix backend run test:e2e

# フロントエンド 単体テスト（カバレッジ付き・1 回実行）
cd frontend && npx ng test --watch=false
```

カバレッジの HTML レポートは `backend/coverage/lcov-report/` / `frontend/coverage/uma-crown-simulator/lcov-report/` に出力されます。

## テスト構成

```
backend/test/
├── unit/                      # 単体テスト（src/ と同じ相対パスに配置）
│   ├── __mocks__/             # nestjs-pino のグローバルモック
│   ├── auth/
│   ├── common/                # cognito / exceptions / filters / guards / utils
│   ├── race/                  # race.service / pattern.helpers / race-pattern.*
│   ├── seed/
│   └── umamusume/
└── e2e/                       # Controller 層の E2E テスト

frontend/test/unit/
├── core/                      # guards / interceptors / services
└── shared/                    # components/toast / utils
```

テストの書き方（命名・モック方針・ファイル配置）は [テスト規約](../prompts/coding-convention/backend/testing.md) を参照してください。
