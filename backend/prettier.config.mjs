// バックエンド Prettier 設定
// コードフォーマットを統一し、レビュー時のスタイル議論を排除する。
// EditorConfig（frontend/.editorconfig）と整合を取ること。
export default {
  // シングルクォートを使う（TypeScript コミュニティの慣例。ダブルクォートより視認性が高い）
  singleQuote: true,
  // 末尾カンマを全箇所に付ける（git diff のノイズ削減。要素追加時に既存行が変更されない）
  trailingComma: 'all',
};
