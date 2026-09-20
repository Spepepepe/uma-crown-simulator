/// <reference types="vitest" />
// カバレッジ閾値の設定（Angular CLI の unit-test builder が閾値をサポートしないため、
// Vitest ネイティブの設定で補完する）
// angular.json の "runnerConfig": true によりこのファイルが読み込まれる
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      // 分岐網羅を重視し、全指標で 90% 以上を維持する
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});
