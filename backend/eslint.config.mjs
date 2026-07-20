// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // 規約（prompt/coding-convention）で機械強制できるルールをここに集約する。
    // ドキュメントで守らせるのではなく、lint で必ず落とすことで乖離を防ぐ。
    rules: {
      // any 禁止（index.md §1-3・Anti-patterns）— テストの mock は下部の override で緩和
      '@typescript-eslint/no-explicit-any': 'error',
      // 型安全性（暗黙 any の漏れを検出）
      '@typescript-eslint/no-unsafe-argument': 'error',
      // await 漏れ・fire-and-forget 禁止（typescript.md §2-1）
      '@typescript-eslint/no-floating-promises': 'error',
      // 未使用変数禁止（_ プレフィックスは意図的な未使用として許容）
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // console 禁止（logging.md — PinoLogger を使う）
      'no-console': 'error',
      // parseInt の基数必須（typescript.md §3-1）
      radix: 'error',
      // process.env 直接アクセス禁止（index.md §1-4 — ConfigService 経由のみ）
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message:
            '環境変数は ConfigService 経由で取得してください（process.env の直接アクセスは禁止）',
        },
      ],
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    // テストコードは mock で any を多用するため型安全系ルールを緩和する（testing.md §4）
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // supertest 等の CommonJS モジュールは import = require が定石
      '@typescript-eslint/no-require-imports': 'off',
      // jest の expect(mock.method) 参照で誤検知するため緩和
      '@typescript-eslint/unbound-method': 'off',
    },
  },
);
