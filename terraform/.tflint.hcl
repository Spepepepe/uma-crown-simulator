# ============================================
# TFLint 設定（.github/workflows/iac.yml から実行）
# ============================================
# terraform validate では検出できない問題（未使用の宣言・命名規則・AWS の不正な値など）を検査する。
# ============================================

config {
  # ローカルモジュール（./modules/*）の呼び出しも、渡された値を展開して検査する
  call_module_type = "local"
}

# Terraform 言語のベストプラクティス（未使用の変数・型未指定・バージョン未固定など）
plugin "terraform" {
  enabled = true
  preset  = "recommended"
}

# AWS 固有の検査（存在しないインスタンスタイプ・不正なリージョン指定など）
# プラグインはバージョンを固定して取得する（tflint --init 時に GitHub Releases からダウンロード）
plugin "aws" {
  enabled = true
  version = "0.49.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}
