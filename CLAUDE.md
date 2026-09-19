# Uma Crown Simulator - Claude Code 設定

## セッション開始時に必ず読むこと

以下のファイルを順番に読み、プロジェクトの全容を把握してからタスクに入ること。

- `prompts/system.md` — プロジェクト概要・技術スタック・設計・ビジネスロジック
- `prompts/coding-convention/index.md` — 共通コーディング規約（命名・型安全性・JSDoc）
- `prompts/coding-convention/typescript.md` — TypeScript / ESM 言語ルール
- `prompts/coding-convention/backend/index.md` — バックエンド規約（NestJS アプリケーション層）
- `prompts/coding-convention/backend/prisma.md` — Prisma（DB 層）規約
- `prompts/coding-convention/backend/error.md` — エラーハンドリング規約
- `prompts/coding-convention/backend/logging.md` — ログ規約
- `prompts/coding-convention/backend/testing.md` — テスト規約
- `prompts/coding-convention/backend/boilerplate.md` — ボイラープレートテンプレート・ディレクトリ配置
- `prompts/coding-convention/frontend/index.md` — フロントエンド規約（Angular）
- `prompts/operations.md` — ローカルデプロイ手順・kubectl 操作・npm scripts
- `prompts/commit.md` — コミット運用フロー（メッセージ提示 → 承認 → コミット → プッシュ）とメッセージスタイル

## ドキュメント・コード整合性の検証

タスク完了時、変更内容が `prompts/` 配下のドキュメントに影響する場合は、該当ドキュメントも同時に更新すること。

特に以下を検証する:

- `prompts/system.md` のディレクトリ構成・DB スキーマ・API 一覧が実コードと一致しているか
- `prompts/coding-convention/` の規約に反する変更を行っていないか
- 新規モジュール追加時、`prompts/system.md` に反映されているか
