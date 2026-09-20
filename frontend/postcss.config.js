// PostCSS プラグイン設定
// Angular の CSS ビルドパイプラインに Tailwind CSS v4 を組み込む。
// Tailwind CSS v4 は PostCSS プラグインとして動作し、
// @tailwindcss/postcss がユーティリティクラスの生成・パージを担う。
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
