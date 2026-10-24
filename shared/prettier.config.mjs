// 共有型定義 Prettier 設定
// backend / frontend の両方から import されるため、両者と同じスタイル（backend/prettier.config.mjs と同値）にそろえる。
export default {
  // シングルクォートを使う（backend / frontend と同じ）
  singleQuote: true,
  // 末尾カンマを全箇所に付ける（git diff のノイズ削減。要素追加時に既存行が変更されない）
  trailingComma: 'all',
};
