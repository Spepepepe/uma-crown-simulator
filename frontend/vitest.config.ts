/// <reference types="vitest" />
// カバレッジ閾値の設定（Angular CLI の unit-test builder が閾値をサポートしないため、
// Vitest ネイティブの設定で補完する）
// angular.json の "runnerConfig": true によりこのファイルが読み込まれる
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      // 分岐網羅（branches）を主指標とし、80% を下回ったら CI を失敗させる
      // functions / lines / statements は分岐網羅の副次指標として 90% を維持する
      thresholds: {
        branches: 80,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});
